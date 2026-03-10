import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { requireRole, withAudit } from "@/lib/authz";
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

    if (po.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only cancel DRAFT purchase orders" },
        { status: 400 }
      );
    }

    // Update status
    await db
      .update(purchaseOrders)
      .set({ status: "CANCELLED" })
      .where(eq(purchaseOrders.id, id));

    // Audit log
    await withAudit(
      "po_cancelled",
      { poId: id, status: "DRAFT" },
      { poId: id, status: "CANCELLED" },
      orgId,
      request
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error cancelling purchase order:", error);

    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: "Failed to cancel purchase order" },
      { status: 500 }
    );
  }
}
