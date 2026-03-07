import { db } from "@/db";
import {
  ingredients,
  suppliers,
  ingredientSuppliers,
  menuItems,
  recipes,
  recipeLines,
  users,
  memberships,
  staff,
  dailySales,
  stockMovements,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export type CommitResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

// Helper to get original row number from normalized row
function getRowNumber(row: any, index: number): number {
  return row.originalRowNumber || index + 1;
}

/**
 * INGREDIENTS COMMITTER
 * Upserts ingredients + supplier relationships
 * Schema: ingredients (orgId, name, unit, costPerUnitCents, currentStockLevel, isActive, externalId)
 */
export async function commitIngredients(
  orgId: string,
  venueId: string,
  normalizedRows: any[]
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  await db.transaction(async (tx) => {
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      if (!row || row.status !== "ok") {
        result.skipped++;
        continue;
      }

      try {
        const data = row.data;

        // Upsert ingredient by (orgId, name)
        const [ingredient] = await tx
          .insert(ingredients)
          .values({
            orgId,
            name: data.name,
            unit: data.purchaseUnit,
            costPerUnitCents: data.costPerUnitCents || 0,
            currentStockLevel: "0",
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [ingredients.orgId, ingredients.name],
            set: {
              unit: data.purchaseUnit,
              costPerUnitCents: data.costPerUnitCents || sql`COALESCE(${ingredients.costPerUnitCents}, 0)`,
            },
          })
          .returning({ id: ingredients.id, isNew: sql<boolean>`(xmax = 0)` });

        if (ingredient.isNew) result.created++;
        else result.updated++;

        // If supplier info provided, handle supplier relationship
        if (data.preferredSupplier && data.packCostCents) {
          // Find or create supplier
          const [supplier] = await tx
            .insert(suppliers)
            .values({
              orgId,
              name: data.preferredSupplier,
              isActive: true,
            })
            .onConflictDoUpdate({
              target: [suppliers.orgId, suppliers.name],
              set: { name: data.preferredSupplier },
            })
            .returning({ id: suppliers.id });

          // Calculate pack size in base units
          const packSizeBase = data.packSize && data.packUnit
            ? (data.packUnit === "g" || data.packUnit === "ml" ? data.packSize : data.packSize * 1000)
            : 1;

          const unitPriceCents = data.costPerUnitCents || Math.round((data.packCostCents || 0) / packSizeBase);

          // Upsert ingredient_supplier relationship
          await tx
            .insert(ingredientSuppliers)
            .values({
              orgId,
              ingredientId: ingredient.id,
              supplierId: supplier.id,
              sku: data.supplierSku || "",
              packSize: String(packSizeBase),
              packUnit: data.purchaseUnit,
              unitPriceCents,
              isPreferred: true,
            })
            .onConflictDoUpdate({
              target: [ingredientSuppliers.orgId, ingredientSuppliers.ingredientId, ingredientSuppliers.supplierId],
              set: {
                packSize: String(packSizeBase),
                unitPriceCents,
                isPreferred: true,
              },
            });
        }
      } catch (error: any) {
        result.errors.push({ row: getRowNumber(row, i), message: error.message });
      }
    }
  });

  return result;
}

/**
 * MENU ITEMS COMMITTER
 * Upserts menu items
 * Schema: menuItems (orgId, name, priceCents, sku, category, isComposite, isActive, externalId)
 */
export async function commitMenuItems(
  orgId: string,
  venueId: string,
  normalizedRows: any[]
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  await db.transaction(async (tx) => {
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      if (!row || row.status !== "ok") {
        result.skipped++;
        continue;
      }

      try {
        const data = row.data;

        const [item] = await tx
          .insert(menuItems)
          .values({
            orgId,
            name: data.name,
            priceCents: data.priceCents,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [menuItems.orgId, menuItems.name],
            set: {
              priceCents: data.priceCents,
            },
          })
          .returning({ id: menuItems.id, isNew: sql<boolean>`(xmax = 0)` });

        if (item.isNew) result.created++;
        else result.updated++;
      } catch (error: any) {
        result.errors.push({ row: getRowNumber(row, i), message: error.message });
      }
    }
  });

  return result;
}

/**
 * RECIPES COMMITTER
 * Upserts recipe lines (replaces entire recipe for each menu item)
 * Schema: recipes (orgId, menuItemId, yieldQty, yieldUnit, wastagePct)
 * Schema: recipeLines (orgId, recipeId, ingredientId, subMenuItemId, qty, unit, notes)
 */
export async function commitRecipes(
  orgId: string,
  venueId: string,
  normalizedRows: any[]
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  await db.transaction(async (tx) => {
    // Group rows by menu item
    const byMenuItem = new Map<string, any[]>();
    
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      if (!row || row.status !== "ok") {
        result.skipped++;
        continue;
      }

      const key = row.data.menuItemId || row.data.menuItemName;
      if (!byMenuItem.has(key)) {
        byMenuItem.set(key, []);
      }
      byMenuItem.get(key)!.push({ row: row.data, index: i });
    }

    // Process each menu item's recipe
    for (const [menuItemKey, recipeRows] of byMenuItem.entries()) {
      try {
        // Resolve menu item
        let menuItemId: string;
        if (recipeRows[0].row.menuItemId) {
          menuItemId = recipeRows[0].row.menuItemId;
        } else {
          const [item] = await tx
            .select({ id: menuItems.id })
            .from(menuItems)
            .where(
              and(
                eq(menuItems.orgId, orgId),
                sql`LOWER(${menuItems.name}) = LOWER(${recipeRows[0].row.menuItemName})`
              )
            )
            .limit(1);

          if (!item) throw new Error(`Menu item not found: ${recipeRows[0].row.menuItemName}`);
          menuItemId = item.id;
        }

        // Get or create recipe
        let [recipe] = await tx
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.menuItemId, menuItemId))
          .limit(1);

        if (!recipe) {
          [recipe] = await tx
            .insert(recipes)
            .values({
              orgId,
              menuItemId,
              yieldQty: "1",
              wastagePct: "0",
            })
            .returning({ id: recipes.id });
        }

        // Delete existing recipe lines
        await tx.delete(recipeLines).where(eq(recipeLines.recipeId, recipe.id));

        // Insert new recipe lines
        for (const { row: lineData, index } of recipeRows) {
          try {
            // Resolve ingredient
            let ingredientId: string | null = null;
            if (lineData.ingredientId) {
              ingredientId = lineData.ingredientId;
            } else if (lineData.ingredientName) {
              const [ing] = await tx
                .select({ id: ingredients.id })
                .from(ingredients)
                .where(
                  and(
                    eq(ingredients.orgId, orgId),
                    sql`LOWER(${ingredients.name}) = LOWER(${lineData.ingredientName})`
                  )
                )
                .limit(1);

              if (!ing) throw new Error(`Ingredient not found: ${lineData.ingredientName}`);
              ingredientId = ing.id;
            }

            await tx.insert(recipeLines).values({
              orgId,
              recipeId: recipe.id,
              ingredientId,
              subMenuItemId: null,
              qty: String(lineData.qtyBase),
              unit: lineData.unit,
            });

            result.created++;
          } catch (error: any) {
            const originalRow = normalizedRows[index];
            result.errors.push({ row: getRowNumber(originalRow, index), message: error.message });
          }
        }
      } catch (error: any) {
        // Error at menu item level
        for (const { index } of recipeRows) {
          const originalRow = normalizedRows[index];
          result.errors.push({ row: getRowNumber(originalRow, index), message: error.message });
        }
      }
    }
  });

  return result;
}

/**
 * STAFF COMMITTER
 * Creates/updates users, memberships, and staff records
 * Schema: staff (orgId, venueId, name, email, phone, roleTitle, hourlyRateCents, isActive, externalId)
 */
export async function commitStaff(
  orgId: string,
  venueId: string,
  normalizedRows: any[]
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  await db.transaction(async (tx) => {
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      if (!row || row.status !== "ok") {
        result.skipped++;
        continue;
      }

      try {
        const data = row.data;

        // Upsert user by email
        const [user] = await tx
          .insert(users)
          .values({
            email: data.email,
            name: data.name,
            password_hash: "", // No password for imported staff
          })
          .onConflictDoUpdate({
            target: users.email,
            set: { name: data.name },
          })
          .returning({ id: users.id, isNew: sql<boolean>`(xmax = 0)` });

        // Upsert membership
        await tx
          .insert(memberships)
          .values({
            userId: user.id,
            orgId,
            role: "crew",
          })
          .onConflictDoNothing();

        // Upsert staff record (unique on orgId, email)
        const [staffRecord] = await tx
          .insert(staff)
          .values({
            orgId,
            venueId,
            name: data.name,
            email: data.email,
            roleTitle: data.role,
            hourlyRateCents: data.hourlyRateCents,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [staff.orgId, staff.email],
            set: {
              name: data.name,
              roleTitle: data.role,
              hourlyRateCents: data.hourlyRateCents,
              venueId,
              isActive: true,
            },
          })
          .returning({ isNew: sql<boolean>`(xmax = 0)` });

        if (user.isNew || staffRecord.isNew) result.created++;
        else result.updated++;
      } catch (error: any) {
        result.errors.push({ row: getRowNumber(row, i), message: error.message });
      }
    }
  });

  return result;
}

/**
 * SALES COMMITTER
 * Upserts daily sales (aggregates by date + menu item)
 * Schema: dailySales (orgId, venueId, saleDate, menuItemId, quantitySold)
 * Uses unique index on (venueId, menuItemId, saleDate)
 */
export async function commitSales(
  orgId: string,
  venueId: string,
  normalizedRows: any[]
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  await db.transaction(async (tx) => {
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      if (!row || row.status !== "ok") {
        result.skipped++;
        continue;
      }

      try {
        const data = row.data;

        // Resolve menu item
        let menuItemId: string;
        if (data.menuItemId) {
          menuItemId = data.menuItemId;
        } else {
          const [item] = await tx
            .select({ id: menuItems.id })
            .from(menuItems)
            .where(
              and(
                eq(menuItems.orgId, orgId),
                sql`LOWER(${menuItems.name}) = LOWER(${data.menuItemName})`
              )
            )
            .limit(1);

          if (!item) throw new Error(`Menu item not found: ${data.menuItemName}`);
          menuItemId = item.id;
        }

        const [sale] = await tx
          .insert(dailySales)
          .values({
            orgId,
            venueId,
            saleDate: data.date,
            menuItemId,
            quantitySold: data.qty,
          })
          .onConflictDoUpdate({
            target: [dailySales.venueId, dailySales.menuItemId, dailySales.saleDate],
            set: {
              quantitySold: sql`${dailySales.quantitySold} + ${data.qty}`,
            },
          })
          .returning({ isNew: sql<boolean>`(xmax = 0)` });

        if (sale.isNew) result.created++;
        else result.updated++;
      } catch (error: any) {
        result.errors.push({ row: getRowNumber(row, i), message: error.message });
      }
    }
  });

  return result;
}

/**
 * STOCK COMMITTER
 * Inserts stock movements as snapshot (stock count)
 * Schema: stockMovements (orgId, venueId, ingredientId, type, qtyBase, unitCostCents, refType, refId, occurredAt)
 */
export async function commitStock(
  orgId: string,
  venueId: string,
  userId: string,
  normalizedRows: any[]
): Promise<CommitResult> {
  const result: CommitResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  await db.transaction(async (tx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      if (!row || row.status !== "ok") {
        result.skipped++;
        continue;
      }

      try {
        const data = row.data;

        // Resolve ingredient
        let ingredientId: string;
        if (data.ingredientId) {
          ingredientId = data.ingredientId;
        } else {
          const [ing] = await tx
            .select({ id: ingredients.id })
            .from(ingredients)
            .where(
              and(
                eq(ingredients.orgId, orgId),
                sql`LOWER(${ingredients.name}) = LOWER(${data.ingredientName})`
              )
            )
            .limit(1);

          if (!ing) throw new Error(`Ingredient not found: ${data.ingredientName}`);
          ingredientId = ing.id;
        }

        // Insert stock movement (type: stock_take)
        await tx.insert(stockMovements).values({
          orgId,
          venueId,
          ingredientId,
          type: "stock_take",
          qtyBase: data.qtyBase,
          unitCostCents: 0,
          occurredAt: today,
        });

        result.created++;
      } catch (error: any) {
        result.errors.push({ row: getRowNumber(row, i), message: error.message });
      }
    }
  });

  return result;
}
