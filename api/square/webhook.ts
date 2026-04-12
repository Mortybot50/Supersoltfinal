/**
 * POST /api/square/webhook
 *
 * Receives real-time events from Square (e.g. payment.completed,
 * order.created, order.updated, refund.created). Verifies the HMAC-SHA256
 * signature, processes depletion enqueuing and refund reversals, then
 * returns 200 immediately to avoid Square retries.
 */
import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "./_lib.js";
import { env, supabaseAdmin } from "./_lib.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface PosConnection {
  org_id: string;
  venue_id: string;
  location_ids: string[];
}

interface DepletionMovementRow {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  reference_id: string;
}

// ── Refund/void reversal helper ──────────────────────────────────────────────
// Looks up the original sale_depletion movements for a Square order and creates
// refund_reversal movements to restore the depleted stock.
//
// partialFraction: 0.0–1.0 (1.0 = full reversal). Used when the refund covers
// only part of the order total. Defaults to 1.0 (full reversal).

async function processRefundReversal(
  db: ReturnType<typeof supabaseAdmin>,
  orgId: string,
  venueId: string,
  squareOrderId: string,
  reason: string,
  partialFraction = 1.0,
): Promise<void> {
  // 1. Look up the queue item
  const { data: queueRows } = await (db
    .from("stock_depletion_queue" as "pos_connections")
    .select("id, status, reversed_at")
    .eq("org_id", orgId)
    .eq("square_order_id", squareOrderId)
    .limit(1) as unknown as Promise<{
    data: { id: string; status: string; reversed_at: string | null }[] | null;
  }>);

  const queueItem = queueRows?.[0];

  if (!queueItem) {
    // Order was never enqueued (e.g. no catalog mappings) — nothing to reverse
    console.info(
      `[square/webhook] Reversal skipped — order ${squareOrderId} not in queue`,
    );
    return;
  }

  if (queueItem.reversed_at) {
    // Already reversed — idempotent
    console.info(
      `[square/webhook] Reversal already applied for order ${squareOrderId}`,
    );
    return;
  }

  if (queueItem.status !== "completed") {
    // Depletion was never processed — mark as skipped so it won't be retried
    await (db
      .from("stock_depletion_queue" as "pos_connections")
      .update({
        status: "skipped",
        reversed_at: new Date().toISOString(),
        reversal_reason: reason,
      } as Record<string, unknown>)
      .eq("id", queueItem.id) as unknown as Promise<unknown>);

    console.info(
      `[square/webhook] Skipped unprocessed queue item for order ${squareOrderId} (reason: ${reason})`,
    );
    return;
  }

  // 2. Fetch all sale_depletion movements for this order
  const { data: depletionRows } = await (db
    .from("stock_movements" as "pos_connections")
    .select("id, ingredient_id, quantity, unit, unit_cost, reference_id")
    .eq("org_id", orgId)
    .eq("venue_id", venueId)
    .eq("movement_type", "sale_depletion")
    .eq("reference_id", squareOrderId) as unknown as Promise<{
    data: DepletionMovementRow[] | null;
  }>);

  const movements = depletionRows ?? [];

  if (movements.length === 0) {
    console.info(
      `[square/webhook] No depletion movements found for order ${squareOrderId}`,
    );
    await (db
      .from("stock_depletion_queue" as "pos_connections")
      .update({
        reversed_at: new Date().toISOString(),
        reversal_reason: `${reason} (no movements to reverse)`,
      } as Record<string, unknown>)
      .eq("id", queueItem.id) as unknown as Promise<unknown>);
    return;
  }

  // 3. Build reversal movements (positive quantity restores stock)
  const fraction = Math.min(1.0, Math.max(0.0, partialFraction));
  const reversals = movements.map((m) => ({
    org_id: orgId,
    venue_id: venueId,
    ingredient_id: m.ingredient_id,
    movement_type: "refund_reversal",
    // Depletion quantities are negative — abs() then scale by fraction
    quantity: Math.abs(m.quantity) * fraction,
    unit: m.unit,
    unit_cost: m.unit_cost,
    reference_type: "order",
    reference_id: squareOrderId,
    notes: `${reason}${fraction < 1.0 ? ` (${Math.round(fraction * 100)}% partial reversal)` : ""}`,
  }));

  const { error: insertErr } = await (db
    .from("stock_movements" as "pos_connections")
    .insert(
      reversals as unknown as Record<string, unknown>[],
    ) as unknown as Promise<{
    error: unknown;
  }>);

  if (insertErr) {
    throw new Error(
      `Reversal movement insert failed: ${insertErr instanceof Error ? insertErr.message : JSON.stringify(insertErr)}`,
    );
  }

  // 4. Mark queue item as reversed
  await (db
    .from("stock_depletion_queue" as "pos_connections")
    .update({
      reversed_at: new Date().toISOString(),
      reversal_reason: reason,
    } as Record<string, unknown>)
    .eq("id", queueItem.id) as unknown as Promise<unknown>);

  console.info(
    `[square/webhook] Reversed ${reversals.length} movements for order ${squareOrderId}` +
      (fraction < 1.0
        ? ` (${Math.round(fraction * 100)}% partial)`
        : " (full)"),
  );
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ── Verify webhook signature ────────────────────────────────
    const signatureKey = env("SQUARE_WEBHOOK_SIGNATURE_KEY");
    const notificationUrl = `${env("APP_URL")}/api/square/webhook`;
    const signature = req.headers["x-square-hmacsha256-signature"] as string;

    if (!signature) {
      console.warn("[square/webhook] Missing signature header");
      return res.status(401).json({ error: "Missing signature" });
    }

    // Square signs: notificationUrl + body
    const rawBody =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const payload = notificationUrl + rawBody;

    const expectedSignature = crypto
      .createHmac("sha256", signatureKey)
      .update(payload)
      .digest("base64");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      )
    ) {
      console.warn("[square/webhook] Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // ── Process event ───────────────────────────────────────────
    const event =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const eventType = event?.type ?? "unknown";
    const merchantId = event?.merchant_id ?? "unknown";

    console.info(
      `[square/webhook] Event received: ${eventType} for merchant ${merchantId}`,
    );

    // ── Enqueue order for depletion processing ──────────────────
    if (eventType === "order.created" || eventType === "payment.completed") {
      try {
        const orderId: string | undefined =
          event?.data?.object?.order?.id ??
          event?.data?.object?.payment?.order_id;

        if (orderId) {
          const db = supabaseAdmin();
          const locationId: string =
            event?.data?.object?.order?.location_id ??
            event?.data?.object?.payment?.location_id ??
            "";

          const { data: conn } = (await db
            .from("pos_connections")
            .select("org_id, venue_id, location_ids")
            .eq("provider", "square")
            .contains("location_ids", [locationId])
            .single()) as { data: PosConnection | null };

          if (conn) {
            const lineItems = (event?.data?.object?.order?.line_items ??
              []) as Array<{
              catalog_object_id?: string;
              quantity: string;
              modifiers?: Array<{ catalog_object_id?: string; name?: string }>;
            }>;

            const items = lineItems
              .map((li) => ({
                catalog_item_id: li.catalog_object_id ?? "",
                quantity: parseFloat(li.quantity ?? "1"),
                modifiers: (li.modifiers ?? []).map((m) => ({
                  modifier_id: m.catalog_object_id ?? "",
                  modifier_name: m.name ?? "",
                })),
              }))
              .filter((li) => li.catalog_item_id);

            if (items.length > 0) {
              await db
                .from("stock_depletion_queue" as "pos_connections")
                .upsert(
                  {
                    org_id: conn.org_id,
                    venue_id: conn.venue_id,
                    square_order_id: orderId,
                    line_items: items,
                    status: "pending",
                  } as Record<string, unknown>,
                  { onConflict: "org_id,square_order_id" },
                );

              console.info(
                `[square/webhook] Enqueued order ${orderId} for depletion (${items.length} line items)`,
              );
            }
          }
        }
      } catch (enqueueErr) {
        console.error(
          "[square/webhook] Failed to enqueue order for depletion:",
          enqueueErr,
        );
      }
    }

    // ── order.updated — re-enqueue updated orders OR reverse canceled/voided ─
    if (eventType === "order.updated") {
      try {
        const order = event?.data?.object?.order as
          | Record<string, unknown>
          | undefined;
        const orderId = order?.id as string | undefined;
        const orderState = order?.state as string | undefined;
        const locationId = order?.location_id as string | undefined;

        if (orderId && locationId) {
          const db = supabaseAdmin();

          const { data: conn } = (await db
            .from("pos_connections")
            .select("org_id, venue_id, location_ids")
            .eq("provider", "square")
            .contains("location_ids", [locationId])
            .single()) as { data: PosConnection | null };

          if (conn) {
            if (orderState === "CANCELED" || orderState === "VOIDED") {
              // Reverse all stock depletions for this canceled/voided order
              await processRefundReversal(
                db,
                conn.org_id,
                conn.venue_id,
                orderId,
                `order_${orderState.toLowerCase()}`,
              );
            } else {
              // Order updated but not canceled — re-enqueue with latest line items
              const lineItems = (order?.line_items ?? []) as Array<{
                catalog_object_id?: string;
                quantity: string;
                modifiers?: Array<{
                  catalog_object_id?: string;
                  name?: string;
                }>;
              }>;

              const items = lineItems
                .map((li) => ({
                  catalog_item_id: li.catalog_object_id ?? "",
                  quantity: parseFloat(li.quantity ?? "1"),
                  modifiers: (li.modifiers ?? []).map((m) => ({
                    modifier_id: m.catalog_object_id ?? "",
                    modifier_name: m.name ?? "",
                  })),
                }))
                .filter((li) => li.catalog_item_id);

              if (items.length > 0) {
                await db
                  .from("stock_depletion_queue" as "pos_connections")
                  .upsert(
                    {
                      org_id: conn.org_id,
                      venue_id: conn.venue_id,
                      square_order_id: orderId,
                      line_items: items,
                      status: "pending",
                    } as Record<string, unknown>,
                    { onConflict: "org_id,square_order_id" },
                  );

                console.info(
                  `[square/webhook] Re-enqueued updated order ${orderId}`,
                );
              }
            }
          }
        }
      } catch (orderUpdateErr) {
        console.error(
          "[square/webhook] Failed to process order.updated:",
          orderUpdateErr,
        );
      }
    }

    // ── refund.created — reverse stock depletions ────────────────────────────
    if (eventType === "refund.created") {
      try {
        const refund = event?.data?.object?.refund as
          | Record<string, unknown>
          | undefined;
        const orderId = refund?.order_id as string | undefined;
        const locationId = refund?.location_id as string | undefined;
        const refundAmount = (
          refund?.amount_money as Record<string, unknown> | undefined
        )?.amount as number | undefined;

        if (orderId && locationId) {
          const db = supabaseAdmin();

          const { data: conn } = (await db
            .from("pos_connections")
            .select("org_id, venue_id, location_ids")
            .eq("provider", "square")
            .contains("location_ids", [locationId])
            .single()) as { data: PosConnection | null };

          if (conn) {
            // Attempt to determine the partial fraction from refund amount vs order total.
            // The order total may be present in the event when Square sends full order state.
            const orderTotal = (
              event?.data?.object?.order as Record<string, unknown> | undefined
            )?.total_money as Record<string, unknown> | undefined;
            const orderTotalAmount = orderTotal?.amount as number | undefined;

            let partialFraction = 1.0;
            if (refundAmount && orderTotalAmount && orderTotalAmount > 0) {
              partialFraction = Math.min(1.0, refundAmount / orderTotalAmount);
            }

            await processRefundReversal(
              db,
              conn.org_id,
              conn.venue_id,
              orderId,
              "refund_created",
              partialFraction,
            );
          }
        }
      } catch (refundErr) {
        console.error(
          "[square/webhook] Failed to process refund reversal:",
          refundErr,
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: unknown) {
    console.error("[square/webhook] Error:", err);
    // Still return 200 to prevent Square from retrying
    return res.status(200).json({ received: true, error: "Processing failed" });
  }
}
