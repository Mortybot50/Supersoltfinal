import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderLines, suppliers } from "@/db/schema";
import { requireRole, getSessionUser, withAudit } from "@/lib/authz";
import { generatePoNumber, ceilPacks } from "@/lib/purchasing";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

const CreateFromOrderGuideSchema = z.object({
  start: z.string(),
  days: z.number(),
  safetyDays: z.number(),
  overrides: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      supplierId: z.string().uuid().nullable(),
      recommendedPacks: z.number(),
      packCostCents: z.number().optional(),
      packLabel: z.string().optional(),
      baseUom: z.string(),
      baseQtyPerPack: z.number(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    // Get session and validate
    const user = await getSessionUser();
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json(
        { error: "Organization and venue must be selected" },
        { status: 400 }
      );
    }

    // Require manager role
    await requireRole(orgId, ["owner", "manager"]);

    // Parse and validate body
    const body = await request.json();
    const { overrides } = CreateFromOrderGuideSchema.parse(body);

    // Group lines by supplier
    const linesBySupplier = new Map<
      string,
      Array<{
        ingredientId: string;
        recommendedPacks: number;
        packCostCents: number;
        packLabel?: string;
        baseUom: string;
        baseQtyPerPack: number;
      }>
    >();

    for (const line of overrides) {
      if (!line.supplierId) continue; // Skip items without suppliers

      if (!linesBySupplier.has(line.supplierId)) {
        linesBySupplier.set(line.supplierId, []);
      }

      linesBySupplier.get(line.supplierId)!.push({
        ingredientId: line.ingredientId,
        recommendedPacks: line.recommendedPacks,
        packCostCents: line.packCostCents || 0,
        packLabel: line.packLabel,
        baseUom: line.baseUom,
        baseQtyPerPack: line.baseQtyPerPack,
      });
    }

    // Create one PO per supplier
    const createdPos: Array<{
      id: string;
      number: string;
      supplierName: string;
      totals: {
        subtotalCents: number;
        taxCents: number;
        totalCents: number;
      };
    }> = [];

    for (const [supplierId, lines] of linesBySupplier.entries()) {
      // Get supplier name
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);

      if (!supplier) continue;

      // Generate PO number
      const poNumber = await generatePoNumber(orgId, venueId);

      // Calculate subtotal
      let subtotalCents = 0;
      const poLines: Array<{
        ingredientId: string;
        packLabel?: string;
        baseUom: string;
        baseQtyPerPack: number;
        packsOrdered: number;
        packCostCents: number;
        lineTotalCents: number;
      }> = [];

      for (const line of lines) {
        const packsOrdered = line.recommendedPacks; // Keep as decimal for DRAFT
        const lineTotalCents = Math.round(packsOrdered * line.packCostCents);
        subtotalCents += lineTotalCents;

        poLines.push({
          ingredientId: line.ingredientId,
          packLabel: line.packLabel,
          baseUom: line.baseUom,
          baseQtyPerPack: line.baseQtyPerPack,
          packsOrdered,
          packCostCents: line.packCostCents,
          lineTotalCents,
        });
      }

      const taxCents = 0; // Simple 0% tax for now
      const totalCents = subtotalCents + taxCents;

      // Create PO
      const [po] = await db
        .insert(purchaseOrders)
        .values({
          orgId,
          venueId,
          supplierId,
          number: poNumber,
          status: "DRAFT",
          currency: "AUD",
          subtotalCents,
          taxCents,
          totalCents,
          createdBy: user.id,
        })
        .returning();

      // Create PO lines
      await db.insert(purchaseOrderLines).values(
        poLines.map((line) => ({
          poId: po.id,
          ingredientId: line.ingredientId,
          packLabel: line.packLabel || null,
          baseUom: line.baseUom,
          baseQtyPerPack: line.baseQtyPerPack,
          packsOrdered: String(line.packsOrdered),
          packCostCents: line.packCostCents,
          lineTotalCents: line.lineTotalCents,
        }))
      );

      // Audit log
      await withAudit(
        "po_created_from_order_guide",
        null,
        { poId: po.id, number: poNumber, supplierId, lines: poLines.length },
        orgId,
        request
      );

      createdPos.push({
        id: po.id,
        number: poNumber,
        supplierName: supplier.name,
        totals: {
          subtotalCents,
          taxCents,
          totalCents,
        },
      });
    }

    return NextResponse.json({ pos: createdPos });
  } catch (error: any) {
    console.error("Error creating POs from order guide:", error);

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
      { error: "Failed to create purchase orders" },
      { status: 500 }
    );
  }
}
