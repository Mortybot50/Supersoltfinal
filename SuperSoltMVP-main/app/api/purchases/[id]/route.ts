import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  purchaseOrders,
  purchaseOrderLines,
  suppliers,
  ingredients,
} from "@/db/schema";
import { requireRole, withAudit } from "@/lib/authz";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

const UpdatePoSchema = z.object({
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        id: z.string().uuid(),
        packsOrdered: z.number().positive(),
        packCostCents: z.number().nonnegative(),
      })
    )
    .optional(),
});

export async function GET(
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

    await requireRole(orgId, ["owner", "manager", "supervisor"]);

    // Fetch PO with supplier
    const [po] = await db
      .select({
        id: purchaseOrders.id,
        orgId: purchaseOrders.orgId,
        venueId: purchaseOrders.venueId,
        number: purchaseOrders.number,
        status: purchaseOrders.status,
        currency: purchaseOrders.currency,
        expectedDate: purchaseOrders.expectedDate,
        notes: purchaseOrders.notes,
        subtotalCents: purchaseOrders.subtotalCents,
        taxCents: purchaseOrders.taxCents,
        totalCents: purchaseOrders.totalCents,
        createdAt: purchaseOrders.createdAt,
        sentAt: purchaseOrders.sentAt,
        receivedAt: purchaseOrders.receivedAt,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        supplierEmail: suppliers.contactEmail,
        supplierPhone: suppliers.phone,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
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

    // Fetch PO lines with ingredient info
    const lines = await db
      .select({
        id: purchaseOrderLines.id,
        ingredientId: purchaseOrderLines.ingredientId,
        ingredientName: ingredients.name,
        packLabel: purchaseOrderLines.packLabel,
        baseUom: purchaseOrderLines.baseUom,
        baseQtyPerPack: purchaseOrderLines.baseQtyPerPack,
        packsOrdered: purchaseOrderLines.packsOrdered,
        packsReceived: purchaseOrderLines.packsReceived,
        packCostCents: purchaseOrderLines.packCostCents,
        lineTotalCents: purchaseOrderLines.lineTotalCents,
      })
      .from(purchaseOrderLines)
      .leftJoin(
        ingredients,
        eq(purchaseOrderLines.ingredientId, ingredients.id)
      )
      .where(eq(purchaseOrderLines.poId, id));

    return NextResponse.json({ po, lines });
  } catch (error: any) {
    console.error("Error fetching purchase order:", error);

    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Fetch PO to verify it's DRAFT and belongs to org/venue
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
        { error: "Can only edit draft purchase orders" },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const updates = UpdatePoSchema.parse(body);

    // Update PO
    const poUpdates: any = {};
    if (updates.expectedDate !== undefined) {
      poUpdates.expectedDate = updates.expectedDate;
    }
    if (updates.notes !== undefined) {
      poUpdates.notes = updates.notes;
    }

    // Update lines if provided
    if (updates.lines && updates.lines.length > 0) {
      let newSubtotalCents = 0;

      for (const lineUpdate of updates.lines) {
        const lineTotalCents = Math.round(
          lineUpdate.packsOrdered * lineUpdate.packCostCents
        );

        await db
          .update(purchaseOrderLines)
          .set({
            packsOrdered: String(lineUpdate.packsOrdered),
            packCostCents: lineUpdate.packCostCents,
            lineTotalCents,
          })
          .where(eq(purchaseOrderLines.id, lineUpdate.id));

        newSubtotalCents += lineTotalCents;
      }

      poUpdates.subtotalCents = newSubtotalCents;
      poUpdates.totalCents = newSubtotalCents; // 0% tax for now
    }

    if (Object.keys(poUpdates).length > 0) {
      await db
        .update(purchaseOrders)
        .set(poUpdates)
        .where(eq(purchaseOrders.id, id));

      await withAudit(
        "po_updated",
        { poId: id, status: "DRAFT" },
        poUpdates,
        orgId,
        request
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating purchase order:", error);

    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update purchase order" },
      { status: 500 }
    );
  }
}
