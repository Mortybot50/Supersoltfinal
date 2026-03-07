import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { countSessions, countLines, stockMovements, ingredients } from "@/db/schema";
import { requireOrg, requireRole } from "@/lib/authz";
import { and, eq } from "drizzle-orm";

// POST /api/counts/sessions/[id]/post - Post count session adjustments
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json(
        { error: "Organization and venue must be selected" },
        { status: 400 }
      );
    }

    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    const { id: sessionId } = params;

    // Verify session exists and is in APPROVED status
    const session = await db.query.countSessions.findFirst({
      where: and(
        eq(countSessions.id, sessionId),
        eq(countSessions.orgId, orgId),
        eq(countSessions.venueId, venueId)
      ),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Count session not found" },
        { status: 404 }
      );
    }

    if (session.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only APPROVED sessions can be posted" },
        { status: 400 }
      );
    }

    // Get all lines with non-zero variance
    const lines = await db.query.countLines.findMany({
      where: eq(countLines.sessionId, sessionId),
    });

    let adjustmentCount = 0;

    // Wrap in transaction for data integrity
    await db.transaction(async (tx) => {
      // Create stock movements for each variance
      for (const line of lines) {
        if (line.varianceBase === 0) continue;

        // Get ingredient to get current average cost
        const ingredient = await tx.query.ingredients.findFirst({
          where: eq(ingredients.id, line.ingredientId),
        });

        const unitCostCents = ingredient?.costPerUnitCents || 0;

        // Create ADJUSTMENT movement
        await tx.insert(stockMovements).values({
          orgId,
          venueId,
          ingredientId: line.ingredientId,
          type: "ADJUSTMENT",
          qtyBase: line.varianceBase,
          unitCostCents,
          refType: "COUNT",
          refId: sessionId,
          occurredAt: new Date(),
        });

        // Update ingredient stock level
        // Note: currentStockLevel is stored as numeric, need to handle conversion
        if (ingredient) {
          const currentStock = parseFloat(ingredient.currentStockLevel);
          const newStock = currentStock + line.varianceBase;
          
          await tx
            .update(ingredients)
            .set({
              currentStockLevel: String(newStock),
            })
            .where(eq(ingredients.id, line.ingredientId));
        }

        adjustmentCount++;
      }

      // Update session status to POSTED
      await tx
        .update(countSessions)
        .set({
          status: "POSTED",
          postedAt: new Date(),
        })
        .where(eq(countSessions.id, sessionId));
    });

    return NextResponse.json({
      success: true,
      status: "POSTED",
      adjustmentsCreated: adjustmentCount,
    });
  } catch (error) {
    console.error("Error posting count session:", error);
    return NextResponse.json(
      { error: "Failed to post count session" },
      { status: 500 }
    );
  }
}
