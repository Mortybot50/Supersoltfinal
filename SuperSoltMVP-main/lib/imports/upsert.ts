import { db } from "@/db";
import {
  ingredients,
  suppliers,
  menuItems,
  staff,
  dailySales,
  ingredientSuppliers,
  recipes,
  recipeLines,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  NormalizedIngredient,
  NormalizedStaff,
  NormalizedMenuItem,
  NormalizedStock,
  NormalizedSalesDaily,
} from "./normalize";
import type { SupplierRowType } from "./schemas";

export interface UpsertResult {
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
}

// Upsert suppliers
export async function upsertSuppliers(args: {
  orgId: string;
  rows: SupplierRowType[];
}): Promise<UpsertResult> {
  const { orgId, rows } = args;
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of rows) {
    try {
      const existing = await db.query.suppliers.findFirst({
        where: and(
          eq(suppliers.orgId, orgId),
          eq(suppliers.externalId, row.external_id)
        ),
      });

      if (existing) {
        // Check if update is needed
        const needsUpdate =
          existing.name !== row.name ||
          existing.contactEmail !== (row.contact_email || null) ||
          existing.phone !== (row.phone || null) ||
          existing.notes !== (row.notes || null);

        if (needsUpdate) {
          await db
            .update(suppliers)
            .set({
              name: row.name,
              contactEmail: row.contact_email || null,
              phone: row.phone || null,
              notes: row.notes || null,
              updatedAt: new Date(),
            })
            .where(eq(suppliers.id, existing.id));
          result.updated++;
        } else {
          result.unchanged++;
        }
      } else {
        await db.insert(suppliers).values({
          orgId,
          externalId: row.external_id,
          name: row.name,
          contactEmail: row.contact_email || null,
          phone: row.phone || null,
          notes: row.notes || null,
          isActive: true,
        });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${row.external_id}: ${error.message}`);
    }
  }

  return result;
}

// Upsert ingredients and their supplier relationships
export async function upsertIngredients(args: {
  orgId: string;
  rows: NormalizedIngredient[];
}): Promise<UpsertResult> {
  const { orgId, rows } = args;
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of rows) {
    try {
      const existing = await db.query.ingredients.findFirst({
        where: and(
          eq(ingredients.orgId, orgId),
          eq(ingredients.externalId, row.externalId)
        ),
      });

      // Calculate base unit cost from pack cost if provided
      let costPerUnitCents = 0;
      if (row.packCostCents && row.packSize) {
        const totalUnits = row.packSize.packQty * row.packSize.unitQty;
        costPerUnitCents = Math.round(row.packCostCents / totalUnits);
      }

      if (existing) {
        // Check if update is needed
        const needsUpdate =
          existing.name !== row.name ||
          existing.unit !== row.uom ||
          (row.packCostCents && existing.costPerUnitCents !== costPerUnitCents);

        if (needsUpdate) {
          await db
            .update(ingredients)
            .set({
              name: row.name,
              unit: row.uom,
              ...(row.packCostCents && { costPerUnitCents }),
              updatedAt: new Date(),
            })
            .where(eq(ingredients.id, existing.id));
          result.updated++;
        } else {
          result.unchanged++;
        }

        // Handle supplier relationship if provided
        if (row.supplierExternalId && row.packSize && row.packCostCents) {
          await upsertIngredientSupplier({
            orgId,
            ingredientId: existing.id,
            supplierExternalId: row.supplierExternalId,
            packSize: row.packSize,
            packCostCents: row.packCostCents,
          });
        }
      } else {
        const [newIngr] = await db.insert(ingredients).values({
          orgId,
          externalId: row.externalId,
          name: row.name,
          unit: row.uom,
          costPerUnitCents,
          currentStockLevel: "0",
          isActive: true,
        }).returning();
        result.created++;

        // Handle supplier relationship if provided
        if (row.supplierExternalId && row.packSize && row.packCostCents) {
          await upsertIngredientSupplier({
            orgId,
            ingredientId: newIngr.id,
            supplierExternalId: row.supplierExternalId,
            packSize: row.packSize,
            packCostCents: row.packCostCents,
          });
        }
      }
    } catch (error: any) {
      result.errors.push(`${row.externalId}: ${error.message}`);
    }
  }

  return result;
}

// Helper to upsert ingredient-supplier relationship
async function upsertIngredientSupplier(args: {
  orgId: string;
  ingredientId: string;
  supplierExternalId: string;
  packSize: { packQty: number; unitQty: number; uom: string };
  packCostCents: number;
}) {
  const { orgId, ingredientId, supplierExternalId, packSize, packCostCents } = args;

  // Find supplier by external ID
  const supplier = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.orgId, orgId),
      eq(suppliers.externalId, supplierExternalId)
    ),
  });

  if (!supplier) {
    return; // Skip if supplier not found
  }

  // Check if relationship already exists
  const existing = await db.query.ingredientSuppliers.findFirst({
    where: and(
      eq(ingredientSuppliers.orgId, orgId),
      eq(ingredientSuppliers.ingredientId, ingredientId),
      eq(ingredientSuppliers.supplierId, supplier.id)
    ),
  });

  const totalUnits = packSize.packQty * packSize.unitQty;
  const unitPriceCents = Math.round(packCostCents / totalUnits);

  if (existing) {
    await db
      .update(ingredientSuppliers)
      .set({
        packSize: packSize.unitQty.toString(),
        packUnit: packSize.uom,
        unitPriceCents,
        updatedAt: new Date(),
      })
      .where(eq(ingredientSuppliers.id, existing.id));
  } else {
    await db.insert(ingredientSuppliers).values({
      orgId,
      ingredientId,
      supplierId: supplier.id,
      packSize: packSize.unitQty.toString(),
      packUnit: packSize.uom,
      unitPriceCents,
      leadTimeDays: 0,
      isPreferred: false,
    });
  }
}

// Upsert menu items (without recipes for now)
export async function upsertMenuItems(args: {
  orgId: string;
  rows: NormalizedMenuItem[];
}): Promise<UpsertResult> {
  const { orgId, rows } = args;
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of rows) {
    try {
      const existing = await db.query.menuItems.findFirst({
        where: and(
          eq(menuItems.orgId, orgId),
          eq(menuItems.externalId, row.externalId)
        ),
      });

      if (existing) {
        const needsUpdate =
          existing.name !== row.name ||
          existing.priceCents !== row.priceCents ||
          existing.category !== (row.category || null);

        if (needsUpdate) {
          await db
            .update(menuItems)
            .set({
              name: row.name,
              priceCents: row.priceCents,
              category: row.category || null,
              updatedAt: new Date(),
            })
            .where(eq(menuItems.id, existing.id));
          result.updated++;
        } else {
          result.unchanged++;
        }
      } else {
        await db.insert(menuItems).values({
          orgId,
          externalId: row.externalId,
          name: row.name,
          priceCents: row.priceCents,
          category: row.category || null,
          isComposite: false,
          isActive: true,
        });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${row.externalId}: ${error.message}`);
    }
  }

  return result;
}

// Upsert recipes for menu items
export async function upsertRecipes(args: {
  orgId: string;
  rows: NormalizedMenuItem[];
}): Promise<UpsertResult> {
  const { orgId, rows } = args;
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of rows) {
    if (!row.recipeJson) continue;

    try {
      // Find the menu item
      const menuItem = await db.query.menuItems.findFirst({
        where: and(
          eq(menuItems.orgId, orgId),
          eq(menuItems.externalId, row.externalId)
        ),
      });

      if (!menuItem) {
        result.errors.push(`${row.externalId}: Menu item not found`);
        continue;
      }

      // Delete existing recipe components
      const existingRecipe = await db.query.recipes.findFirst({
        where: and(
          eq(recipes.orgId, orgId),
          eq(recipes.menuItemId, menuItem.id)
        ),
      });

      if (existingRecipe) {
        await db.delete(recipeLines).where(eq(recipeLines.recipeId, existingRecipe.id));
      }

      // Create or update recipe header
      const [recipe] = await db
        .insert(recipes)
        .values({
          orgId,
          menuItemId: menuItem.id,
          yieldQty: "1",
          yieldUnit: null,
          wastagePct: "0",
        })
        .onConflictDoUpdate({
          target: [recipes.orgId, recipes.menuItemId],
          set: { updatedAt: new Date() },
        })
        .returning();

      // Add recipe components from JSON
      const components = Array.isArray(row.recipeJson) ? row.recipeJson : [row.recipeJson];
      
      for (const comp of components) {
        if (comp.ingredient_external_id) {
          // Ingredient component
          const ingredient = await db.query.ingredients.findFirst({
            where: and(
              eq(ingredients.orgId, orgId),
              eq(ingredients.externalId, comp.ingredient_external_id)
            ),
          });

          if (ingredient) {
            await db.insert(recipeLines).values({
              orgId,
              recipeId: recipe.id,
              ingredientId: ingredient.id,
              subMenuItemId: null,
              qty: comp.qty.toString(),
              unit: comp.uom,
              notes: null,
            });
          }
        } else if (comp.menu_item_external_id) {
          // Sub-recipe component
          const subMenuItem = await db.query.menuItems.findFirst({
            where: and(
              eq(menuItems.orgId, orgId),
              eq(menuItems.externalId, comp.menu_item_external_id)
            ),
          });

          if (subMenuItem) {
            await db.insert(recipeLines).values({
              orgId,
              recipeId: recipe.id,
              ingredientId: null,
              subMenuItemId: subMenuItem.id,
              qty: comp.qty.toString(),
              unit: comp.uom || "each",
              notes: null,
            });
          }
        }
      }

      if (existingRecipe) {
        result.updated++;
      } else {
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${row.externalId}: ${error.message}`);
    }
  }

  return result;
}

// Upsert staff
export async function upsertStaff(args: {
  orgId: string;
  venueId?: string;
  rows: NormalizedStaff[];
}): Promise<UpsertResult> {
  const { orgId, venueId, rows } = args;
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of rows) {
    try {
      const existing = await db.query.staff.findFirst({
        where: and(
          eq(staff.orgId, orgId),
          eq(staff.externalId, row.externalId)
        ),
      });

      if (existing) {
        const needsUpdate =
          existing.name !== row.name ||
          existing.email !== row.email ||
          existing.phone !== (row.phone || null) ||
          existing.roleTitle !== row.roleTitle ||
          existing.hourlyRateCents !== row.hourlyRateCents;

        if (needsUpdate) {
          await db
            .update(staff)
            .set({
              name: row.name,
              email: row.email,
              phone: row.phone || null,
              roleTitle: row.roleTitle,
              hourlyRateCents: row.hourlyRateCents,
            })
            .where(eq(staff.id, existing.id));
          result.updated++;
        } else {
          result.unchanged++;
        }
      } else {
        await db.insert(staff).values({
          orgId,
          venueId: venueId || null,
          externalId: row.externalId,
          name: row.name,
          email: row.email,
          phone: row.phone || null,
          roleTitle: row.roleTitle,
          hourlyRateCents: row.hourlyRateCents,
          isActive: true,
        });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${row.externalId}: ${error.message}`);
    }
  }

  return result;
}

// Upsert sales data
export async function upsertSalesDaily(args: {
  orgId: string;
  venueId: string;
  rows: NormalizedSalesDaily[];
}): Promise<UpsertResult> {
  const { orgId, venueId, rows } = args;
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of rows) {
    try {
      // Find menu item by external ID
      const menuItem = await db.query.menuItems.findFirst({
        where: and(
          eq(menuItems.orgId, orgId),
          eq(menuItems.externalId, row.menuItemExternalId)
        ),
      });

      if (!menuItem) {
        result.errors.push(`${row.date}/${row.menuItemExternalId}: Menu item not found`);
        continue;
      }

      const existing = await db.query.dailySales.findFirst({
        where: and(
          eq(dailySales.venueId, venueId),
          eq(dailySales.menuItemId, menuItem.id),
          eq(dailySales.saleDate, row.date)
        ),
      });

      const qtySold = Math.round(row.qty);

      if (existing) {
        const needsUpdate = existing.quantitySold !== qtySold;

        if (needsUpdate) {
          await db
            .update(dailySales)
            .set({
              quantitySold: qtySold,
            })
            .where(eq(dailySales.id, existing.id));
          result.updated++;
        } else {
          result.unchanged++;
        }
      } else {
        await db.insert(dailySales).values({
          orgId,
          venueId,
          menuItemId: menuItem.id,
          saleDate: row.date,
          quantitySold: qtySold,
        });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${row.date}/${row.menuItemExternalId}: ${error.message}`);
    }
  }

  return result;
}

// Update stock on hand
export async function upsertStock(args: {
  orgId: string;
  rows: NormalizedStock[];
}): Promise<UpsertResult> {
  const { orgId, rows } = args;
  const result: UpsertResult = { created: 0, updated: 0, unchanged: 0, errors: [] };

  for (const row of rows) {
    try {
      const ingredient = await db.query.ingredients.findFirst({
        where: and(
          eq(ingredients.orgId, orgId),
          eq(ingredients.externalId, row.ingredientExternalId)
        ),
      });

      if (!ingredient) {
        result.errors.push(`${row.ingredientExternalId}: Ingredient not found`);
        continue;
      }

      const currentLevel = parseFloat(ingredient.currentStockLevel);
      if (currentLevel === row.onHandQty) {
        result.unchanged++;
      } else {
        await db
          .update(ingredients)
          .set({
            currentStockLevel: row.onHandQty.toString(),
            updatedAt: new Date(),
          })
          .where(eq(ingredients.id, ingredient.id));
        result.updated++;
      }
    } catch (error: any) {
      result.errors.push(`${row.ingredientExternalId}: ${error.message}`);
    }
  }

  return result;
}
