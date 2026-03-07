export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { db } from "@/db";
import {
  purchaseOrders,
  purchaseOrderLines,
  suppliers,
  ingredients,
  ingredientSuppliers,
} from "@/db/schema";
import { buildOrderGuide } from "@/lib/inventory-ordering";
import { eq, and } from "drizzle-orm";
import { convertUnit } from "@/lib/uom";
import { format } from "date-fns";

/**
 * Create Purchase Orders from Order Guide (grouped by supplier)
 * POST /api/purchases/from-order-guide?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const cookieStore = await cookies();
    const orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("activeVenueId")?.value || cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json(
        { error: "No organization or venue selected" },
        { status: 400 }
      );
    }

    await requireOrg(orgId);

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end dates required" },
        { status: 400 }
      );
    }

    // Build order guide
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const { groups } = await buildOrderGuide({
      orgId,
      venueId,
      range: { start: startDate, end: endDate },
      safetyDays: 0,
    });

    const created: any[] = [];

    // Create one PO per supplier group
    for (const group of groups) {
      if (!group.lines || group.lines.length === 0) continue;

      // Filter lines with recommended packs > 0
      const itemsToOrder = group.lines.filter((l) => l.packsRecommended > 0);
      if (itemsToOrder.length === 0) continue;

      // Generate PO number
      const poNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Get supplier email if we have supplierId
      let supplierEmail: string | null = null;
      if (group.supplierId) {
        const sup = await db
          .select({ contactEmail: suppliers.contactEmail })
          .from(suppliers)
          .where(and(eq(suppliers.id, group.supplierId), eq(suppliers.orgId, orgId)))
          .limit(1);
        
        if (sup.length > 0) {
          supplierEmail = sup[0].contactEmail;
        }
      }

      // Create PO header
      const [po] = await db
        .insert(purchaseOrders)
        .values({
          orgId,
          venueId,
          supplierId: group.supplierId || null,
          supplierName: group.supplierName,
          supplierEmail: supplierEmail,
          number: poNumber,
          status: "DRAFT",
          orderDate: format(startDate, "yyyy-MM-dd"),
          expectedDate: null,
          notes: `Auto-created from Order Guide (${start}..${end})`,
          subtotalCents: 0,
          taxCents: 0,
          totalCents: 0,
          createdBy: user.id,
        })
        .returning();

      let subtotal = 0;

      // Create PO lines
      for (const item of itemsToOrder) {
        const packQty = Math.ceil(item.packsRecommended);
        if (packQty === 0) continue;

        // Get ingredient details for base unit calculation
        const [ing] = await db
          .select({ unit: ingredients.unit })
          .from(ingredients)
          .where(and(eq(ingredients.id, item.ingredientId), eq(ingredients.orgId, orgId)))
          .limit(1);

        const baseUnit = ing?.unit || item.baseUnit;

        // Convert pack size to base units
        const packSize = item.packSize || 1;
        const packUnit = item.packUnit || baseUnit;
        
        let baseQtyPerPack = packSize;
        if (packUnit !== baseUnit) {
          const converted = convertUnit(packSize, packUnit, baseUnit);
          baseQtyPerPack = converted ?? packSize;
        }

        // Unit cost in cents per base unit
        const packCostCents = Math.round((item.unitPrice || 0) * 100 * packSize);
        const unitCostSnap = Math.round(packCostCents / Math.max(1, baseQtyPerPack));
        const extended = packQty * packCostCents;

        await db.insert(purchaseOrderLines).values({
          poId: po.id,
          ingredientId: item.ingredientId,
          supplierItemId: item.supplierId ? null : null, // Would need to look up ingredientSuppliers.id
          packLabel: `${packSize}${packUnit}`,
          packSize: packSize.toString(),
          packUnit: packUnit,
          baseUom: baseUnit,
          baseQtyPerPack: Math.round(baseQtyPerPack),
          packsOrdered: packQty.toString(),
          packsReceived: "0",
          packCostCents,
          unitCostCentsSnapshot: unitCostSnap,
          lineTotalCents: extended,
          note: item.notes.length > 0 ? item.notes.join("; ") : null,
        });

        subtotal += extended;
      }

      // Update PO totals
      await db
        .update(purchaseOrders)
        .set({
          subtotalCents: subtotal,
          taxCents: 0,
          totalCents: subtotal,
        })
        .where(eq(purchaseOrders.id, po.id));

      created.push({ ...po, subtotalCents: subtotal, totalCents: subtotal });
    }

    return NextResponse.json(
      {
        ok: true,
        purchaseOrders: created,
        count: created.length,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("Error creating POs from order guide:", e);
    return NextResponse.json(
      { error: e?.message ?? "failed_to_create_pos" },
      { status: e?.statusCode ?? 500 }
    );
  }
}
