export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { db } from "@/db";
import {
  purchaseOrders,
  purchaseOrderLines,
  ingredients,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Export Purchase Order as CSV
 * GET /api/purchases/[id]/export.csv
 */
export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    await getSessionUser();

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

    const poId = params.id;

    // Fetch PO
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, poId),
          eq(purchaseOrders.orgId, orgId),
          eq(purchaseOrders.venueId, venueId)
        )
      )
      .limit(1);

    if (!po) {
      return new NextResponse("Purchase order not found", { status: 404 });
    }

    // Fetch lines
    const lines = await db
      .select({
        ingredientName: ingredients.name,
        packLabel: purchaseOrderLines.packLabel,
        packSize: purchaseOrderLines.packSize,
        packUnit: purchaseOrderLines.packUnit,
        packsOrdered: purchaseOrderLines.packsOrdered,
        packCostCents: purchaseOrderLines.packCostCents,
        lineTotalCents: purchaseOrderLines.lineTotalCents,
        note: purchaseOrderLines.note,
      })
      .from(purchaseOrderLines)
      .leftJoin(ingredients, eq(ingredients.id, purchaseOrderLines.ingredientId))
      .where(eq(purchaseOrderLines.poId, poId));

    // Build CSV
    const header = `Purchase Order #${po.number}
Supplier: ${po.supplierName || "Unknown"}
Order Date: ${po.orderDate || "N/A"}
Expected Date: ${po.expectedDate || "N/A"}
Status: ${po.status}

`;

    const csvHeader = "Ingredient,Pack Size,Unit,Packs Ordered,Pack Cost (A$),Line Total (A$),Note\n";

    const csvRows = lines
      .map((line) => {
        const ingredientName = (line.ingredientName || "Unknown").replace(/,/g, ";");
        const packSize = line.packSize || "";
        const packUnit = line.packUnit || "";
        const packsOrdered = line.packsOrdered || "0";
        const packCost = ((Number(line.packCostCents) || 0) / 100).toFixed(2);
        const lineTotal = ((Number(line.lineTotalCents) || 0) / 100).toFixed(2);
        const note = (line.note || "").replace(/,/g, ";");

        return `${ingredientName},"${packSize}${packUnit}",${packUnit},${packsOrdered},${packCost},${lineTotal},"${note}"`;
      })
      .join("\n");

    const footer = `\n\nSubtotal,,,,,${((po.subtotalCents || 0) / 100).toFixed(2)},
Tax,,,,,${((po.taxCents || 0) / 100).toFixed(2)},
Total,,,,,${((po.totalCents || 0) / 100).toFixed(2)},
`;

    const csv = header + csvHeader + csvRows + footer;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="PO-${po.number}.csv"`,
      },
    });
  } catch (e: any) {
    console.error("Error exporting PO:", e);
    return new NextResponse("Failed to export purchase order", { status: 500 });
  }
}
