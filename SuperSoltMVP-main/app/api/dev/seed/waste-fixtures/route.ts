export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { db } from "@/db";
import { ingredients, suppliers, ingredientSuppliers, stockMovements, venues } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST() {
  try {
    const user = await getSessionUser();
    
    const cookieStore = await cookies();
    const orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("activeVenueId")?.value || cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No organization or venue selected" }, { status: 400 });
    }

    await requireOrg(orgId);

    // Validate venue belongs to org
    const venue = await db.query.venues.findFirst({
      where: and(eq(venues.id, venueId), eq(venues.orgId, orgId)),
    });

    if (!venue) {
      return NextResponse.json({ error: "Venue not found or access denied" }, { status: 403 });
    }

    // Helper to upsert ingredient by (orgId, name)
    async function upsertIngredient(name: string, unit: "g" | "each", costPerUnitCents: number) {
      const existing = await db.query.ingredients.findFirst({
        where: and(eq(ingredients.orgId, orgId), eq(ingredients.name, name)),
      });
      
      if (existing) {
        // Update the existing ingredient to ensure cost is correct
        const [updated] = await db
          .update(ingredients)
          .set({ costPerUnitCents, unit })
          .where(eq(ingredients.id, existing.id))
          .returning();
        return updated;
      }
      
      const [row] = await db
        .insert(ingredients)
        .values({
          orgId,
          name,
          unit,
          costPerUnitCents,
          currentStockLevel: "0",
          isActive: true,
        })
        .returning();
      
      return row;
    }

    // Helper to ensure supplier exists
    async function ensureSupplier(name: string) {
      const existing = await db.query.suppliers.findFirst({
        where: and(eq(suppliers.orgId, orgId), eq(suppliers.name, name)),
      });
      
      if (existing) return existing;
      
      const [row] = await db
        .insert(suppliers)
        .values({
          orgId,
          name,
          contactEmail: "fixtures@example.com",
          isActive: true,
        })
        .returning();
      
      return row;
    }

    // Helper to ensure supplier item (ingredientSupplier) exists
    async function ensureIngredientSupplier(
      ingredientId: string,
      supplierId: string,
      packSize: number,
      packUnit: string,
      unitPriceCents: number,
      preferred = true
    ) {
      const existing = await db.query.ingredientSuppliers.findFirst({
        where: and(
          eq(ingredientSuppliers.orgId, orgId),
          eq(ingredientSuppliers.ingredientId, ingredientId),
          eq(ingredientSuppliers.supplierId, supplierId)
        ),
      });
      
      if (existing) {
        // Update existing supplier item to ensure pricing is correct
        const [updated] = await db
          .update(ingredientSuppliers)
          .set({
            packSize: packSize.toString(),
            packUnit,
            unitPriceCents,
            isPreferred: preferred,
          })
          .where(eq(ingredientSuppliers.id, existing.id))
          .returning();
        return updated;
      }
      
      const [row] = await db
        .insert(ingredientSuppliers)
        .values({
          orgId,
          ingredientId,
          supplierId,
          packSize: packSize.toString(),
          packUnit,
          unitPriceCents,
          isPreferred: preferred,
          leadTimeDays: 1,
        })
        .returning();
      
      return row;
    }

    // 1) Create two common ingredients with realistic costs
    const chicken = await upsertIngredient("Chicken Breast", "g", 1); // $10/kg = 1000 cents per kg = 1 cent per g
    const lettuce = await upsertIngredient("Cos Lettuce", "each", 150);  // $1.50/each = 150 cents per each

    // 2) Create supplier
    const supplier = await ensureSupplier("Fixture Foods");

    // 3) Create supplier items (ingredientSuppliers)
    // NOTE: unitPriceCents is price PER UNIT (per gram, per each), NOT per pack
    await ensureIngredientSupplier(
      chicken.id,
      supplier.id,
      5000,      // 5kg pack = 5000g
      "g",
      1,         // 1 cent per gram ($10/kg ÷ 1000 = 1 cent/g)
      true
    );

    await ensureIngredientSupplier(
      lettuce.id,
      supplier.id,
      12,        // 12 head pack
      "each",
      150,       // 150 cents per each ($1.50/each)
      true
    );

    // 4) Create small on-hand stock (positive stock movements)
    // Check if seed movements already exist
    const existingChickenSeed = await db.query.stockMovements.findFirst({
      where: and(
        eq(stockMovements.venueId, venueId),
        eq(stockMovements.ingredientId, chicken.id),
        eq(stockMovements.type, "seed")
      ),
    });

    if (!existingChickenSeed) {
      await db.insert(stockMovements).values({
        orgId,
        venueId,
        ingredientId: chicken.id,
        type: "seed",
        qtyBase: 3000, // +3kg (3000g)
        unitCostCents: 1, // 1 cent per g (matching ingredient cost)
        refType: null,
        refId: null,
      });
    }

    const existingLettuceSeed = await db.query.stockMovements.findFirst({
      where: and(
        eq(stockMovements.venueId, venueId),
        eq(stockMovements.ingredientId, lettuce.id),
        eq(stockMovements.type, "seed")
      ),
    });

    if (!existingLettuceSeed) {
      await db.insert(stockMovements).values({
        orgId,
        venueId,
        ingredientId: lettuce.id,
        type: "seed",
        qtyBase: 10, // +10 each
        unitCostCents: 150, // $1.50/each
        refType: null,
        refId: null,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        ingredientIds: {
          chicken: chicken.id,
          lettuce: lettuce.id,
        },
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("Waste fixtures seed error:", e);
    return NextResponse.json(
      { error: e?.message ?? "seed_failed" },
      { status: e?.statusCode ?? 500 }
    );
  }
}
