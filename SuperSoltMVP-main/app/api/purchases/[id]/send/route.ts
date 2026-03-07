import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderLines } from "@/db/schema";
import { requireRole, withAudit } from "@/lib/authz";
import { ceilPacks } from "@/lib/purchasing";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json(
        { error: "Organization and venue must be selected" },
        { status: 400 }
      );
    }

    await requireRole(orgId, ["owner", "manager"]);

    // Check for idempotency key
    const idempotencyKey = request.headers.get("Idempotency-Key");

    // Fetch PO
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, id),
          eq(purchaseOrders.orgId, orgId),
          eq(purchaseOrders.venueId, venueId)
        )
      )
      .limit(1);

    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    // Idempotency check
    if (idempotencyKey && po.idempotencyKey === idempotencyKey) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    if (po.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Purchase order is not in DRAFT status" },
        { status: 400 }
      );
    }

    // Fetch lines
    const lines = await db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.poId, id));

    // Round up packs_ordered and recalculate totals
    let newSubtotalCents = 0;

    for (const line of lines) {
      const roundedPacks = ceilPacks(parseFloat(line.packsOrdered));
      const newLineTotalCents = roundedPacks * line.packCostCents;
      newSubtotalCents += newLineTotalCents;

      await db
        .update(purchaseOrderLines)
        .set({
          packsOrdered: String(roundedPacks),
          lineTotalCents: newLineTotalCents,
        })
        .where(eq(purchaseOrderLines.id, line.id));
    }

    // Update PO status
    await db
      .update(purchaseOrders)
      .set({
        status: "SENT",
        subtotalCents: newSubtotalCents,
        totalCents: newSubtotalCents, // 0% tax
        sentAt: new Date(),
        idempotencyKey: idempotencyKey || undefined,
      })
      .where(eq(purchaseOrders.id, id));

    // Audit log
    await withAudit(
      "po_sent",
      { poId: id, status: "DRAFT" },
      { poId: id, status: "SENT", lines: lines.length, totalCents: newSubtotalCents },
      orgId,
      request
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error sending purchase order:", error);

    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: "Failed to send purchase order" },
      { status: 500 }
    );
  }
}
