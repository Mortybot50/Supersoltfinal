import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { wasteEvents, stockMovements, ingredients } from "@/db/schema";
import { requireOrg, requireRole } from "@/lib/authz";
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";

// Schema for logging waste
const logWasteSchema = z.object({
  ingredientId: z.string().uuid(),
  qtyBase: z.number().int().positive(),
  reason: z.enum(["prep_loss", "expiry", "spillage", "overproduction", "other"]),
  occurredAt: z.string().datetime().optional(),
  notes: z.string().max(256).optional(),
});

// POST /api/inventory/waste - Log waste event
export async function POST(request: NextRequest) {
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
    await requireRole(orgId, ["owner", "manager", "supervisor"]);

    const body = await request.json();
    const { ingredientId, qtyBase, reason, occurredAt, notes } =
      logWasteSchema.parse(body);

    const wasteOccurredAt = occurredAt ? new Date(occurredAt) : new Date();

    // Verify ingredient exists
    const ingredient = await db.query.ingredients.findFirst({
      where: and(
        eq(ingredients.id, ingredientId),
        eq(ingredients.orgId, orgId)
      ),
    });

    if (!ingredient) {
      return NextResponse.json(
        { error: "Ingredient not found" },
        { status: 404 }
      );
    }

    const unitCostCents = ingredient.costPerUnitCents;
    let wasteEventId: string;

    // Wrap in transaction for data integrity
    await db.transaction(async (tx) => {
      // Create waste event
      const [wasteEvent] = await tx
        .insert(wasteEvents)
        .values({
          orgId,
          venueId,
          ingredientId,
          reason,
          qtyBase,
          occurredAt: wasteOccurredAt,
          notes,
        })
        .returning();

      wasteEventId = wasteEvent.id;

      // Create WASTE stock movement (negative quantity)
      await tx.insert(stockMovements).values({
        orgId,
        venueId,
        ingredientId,
        type: "WASTE",
        qtyBase: -Math.abs(qtyBase), // Ensure negative
        unitCostCents,
        refType: "WASTE",
        refId: wasteEvent.id,
        occurredAt: wasteOccurredAt,
      });

      // Update ingredient stock level (decrease)
      const currentStock = parseFloat(ingredient.currentStockLevel);
      const newStock = currentStock - Math.abs(qtyBase);

      await tx
        .update(ingredients)
        .set({
          currentStockLevel: String(Math.max(0, newStock)), // Prevent negative stock
        })
        .where(eq(ingredients.id, ingredientId));
    });

    return NextResponse.json({ id: wasteEventId!, success: true });
  } catch (error) {
    console.error("Error logging waste:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to log waste" },
      { status: 500 }
    );
  }
}

// GET /api/inventory/waste - List waste events
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const ingredientId = searchParams.get("ingredientId");

    const conditions = [
      eq(wasteEvents.orgId, orgId),
      eq(wasteEvents.venueId, venueId),
    ];

    if (from) {
      conditions.push(gte(wasteEvents.occurredAt, new Date(from)));
    }

    if (to) {
      conditions.push(lte(wasteEvents.occurredAt, new Date(to)));
    }

    if (ingredientId) {
      conditions.push(eq(wasteEvents.ingredientId, ingredientId));
    }

    const events = await db
      .select()
      .from(wasteEvents)
      .where(and(...conditions))
      .orderBy(desc(wasteEvents.occurredAt))
      .limit(100);

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error listing waste events:", error);
    return NextResponse.json(
      { error: "Failed to list waste events" },
      { status: 500 }
    );
  }
}
