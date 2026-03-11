/**
 * POST /api/square/webhook
 *
 * Receives real-time events from Square (e.g. payment.completed,
 * order.created). Verifies the HMAC-SHA256 signature, logs the
 * event, and returns 200 immediately to avoid Square retries.
 */
import crypto from 'crypto'
import type { VercelRequest, VercelResponse } from './_lib.js'
import { env, supabaseAdmin } from './_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // ── Verify webhook signature ────────────────────────────────
    const signatureKey = env('SQUARE_WEBHOOK_SIGNATURE_KEY')
    const notificationUrl = `${env('APP_URL')}/api/square/webhook`
    const signature = req.headers['x-square-hmacsha256-signature'] as string

    if (!signature) {
      console.warn('[square/webhook] Missing signature header')
      return res.status(401).json({ error: 'Missing signature' })
    }

    // Square signs: notificationUrl + body
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const payload = notificationUrl + rawBody

    const expectedSignature = crypto
      .createHmac('sha256', signatureKey)
      .update(payload)
      .digest('base64')

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.warn('[square/webhook] Invalid signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // ── Process event ───────────────────────────────────────────
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const eventType = event?.type ?? 'unknown'
    const merchantId = event?.merchant_id ?? 'unknown'

    console.info(`[square/webhook] Event received: ${eventType} for merchant ${merchantId}`)

    // ── Enqueue order for depletion processing ──────────────────
    if (eventType === 'order.created' || eventType === 'order.updated' || eventType === 'payment.completed') {
      try {
        const orderId: string | undefined = event?.data?.object?.order?.id
          ?? event?.data?.object?.payment?.order_id

        if (orderId) {
          const db = supabaseAdmin()

          // Look up the pos_connection to find org_id + venue_id
          const { data: conn } = await db
            .from('pos_connections')
            .select('org_id, venue_id, location_ids')
            .eq('provider', 'square')
            .contains('location_ids', [event?.data?.object?.order?.location_id ?? ''])
            .single() as { data: { org_id: string; venue_id: string; location_ids: string[] } | null }

          if (conn) {
            // Build line_items from Square order object
            const lineItems = (event?.data?.object?.order?.line_items ?? []) as Array<{
              catalog_object_id?: string
              catalog_version?: number
              quantity: string
              modifiers?: Array<{ catalog_object_id?: string; name?: string }>
            }>

            const items = lineItems.map((li) => ({
              catalog_item_id: li.catalog_object_id ?? '',
              quantity: parseFloat(li.quantity ?? '1'),
              modifiers: (li.modifiers ?? []).map((m) => ({
                modifier_id: m.catalog_object_id ?? '',
                modifier_name: m.name ?? '',
              })),
            })).filter((li) => li.catalog_item_id)

            if (items.length > 0) {
              await db
                .from('stock_depletion_queue' as 'pos_connections')
                .upsert({
                  org_id: conn.org_id,
                  venue_id: conn.venue_id,
                  square_order_id: orderId,
                  line_items: items,
                  status: 'pending',
                } as Record<string, unknown>, { onConflict: 'org_id,square_order_id' })

              console.info(`[square/webhook] Enqueued order ${orderId} for depletion (${items.length} line items)`)
            }
          }
        }
      } catch (enqueueErr) {
        // Don't fail the webhook response on depletion queue errors
        console.error('[square/webhook] Failed to enqueue order for depletion:', enqueueErr)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err: unknown) {
    console.error('[square/webhook] Error:', err)
    // Still return 200 to prevent Square from retrying
    return res.status(200).json({ received: true, error: 'Processing failed' })
  }
}
