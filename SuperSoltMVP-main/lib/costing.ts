/**
 * Costing logic for ingredients and menu items
 * Handles recursive cost calculation with nested menu items, wastage, and yield
 */

import { db } from "@/db"
import { ingredients, ingredientSuppliers, recipes, recipeLines, menuItems, purchaseOrderLines, purchaseOrders } from "@/db/schema"
import { eq, and, asc, lte, desc } from "drizzle-orm"
import { convertUnit } from "./uom"

/**
 * Get the best (cheapest) unit cost for an ingredient from active suppliers
 * Returns cost in cents per unit, or null if no supplier pricing exists
 */
export async function getIngredientUnitCost(ingredientId: string, orgId: string): Promise<number | null> {
  const suppliers = await db
    .select()
    .from(ingredientSuppliers)
    .where(and(eq(ingredientSuppliers.ingredientId, ingredientId), eq(ingredientSuppliers.orgId, orgId)))
    .orderBy(asc(ingredientSuppliers.unitPriceCents))
    .limit(1)

  if (suppliers.length > 0) {
    return suppliers[0].unitPriceCents
  }

  // Fall back to manual cost if no supplier pricing
  const [ingredient] = await db
    .select()
    .from(ingredients)
    .where(and(eq(ingredients.id, ingredientId), eq(ingredients.orgId, orgId)))
    .limit(1)

  return ingredient ? ingredient.costPerUnitCents : null
}

/**
 * Calculate the total cost of a menu item based on its recipe
 * Handles:
 * - Ingredient lines (with unit conversion)
 * - Nested menu item lines (recursive)
 * - Wastage percentage
 * - Yield quantity
 * 
 * Returns cost in cents, or null if cost cannot be calculated
 * Throws error if circular dependency detected
 */
export async function getMenuItemCost(
  menuItemId: string,
  orgId: string,
  visited: Set<string> = new Set()
): Promise<number | null> {
  // Detect circular dependencies
  if (visited.has(menuItemId)) {
    throw new Error(`Circular dependency detected in recipe for menu item ${menuItemId}`)
  }

  visited.add(menuItemId)

  // Get recipe header for this menu item
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.menuItemId, menuItemId), eq(recipes.orgId, orgId)))
    .limit(1)

  if (!recipe) {
    // No recipe, cannot calculate cost
    return null
  }

  // Get all recipe lines
  const lines = await db
    .select({
      id: recipeLines.id,
      ingredientId: recipeLines.ingredientId,
      subMenuItemId: recipeLines.subMenuItemId,
      qty: recipeLines.qty,
      unit: recipeLines.unit,
    })
    .from(recipeLines)
    .where(eq(recipeLines.recipeId, recipe.id))

  let totalCost = 0

  for (const line of lines) {
    const qty = parseFloat(line.qty)

    if (line.ingredientId) {
      // Ingredient line - get cost and convert units if necessary
      const ingredientCost = await getIngredientUnitCost(line.ingredientId, orgId)
      
      if (ingredientCost === null) {
        // Cannot calculate cost if ingredient has no pricing
        return null
      }

      // Get ingredient details for unit conversion
      const [ingredient] = await db
        .select()
        .from(ingredients)
        .where(and(eq(ingredients.id, line.ingredientId), eq(ingredients.orgId, orgId)))
        .limit(1)

      if (!ingredient) continue

      // Convert line quantity to ingredient unit for cost calculation
      let convertedQty = qty
      if (line.unit !== ingredient.unit) {
        const converted = convertUnit(qty, line.unit, ingredient.unit)
        if (converted === null) {
          // Units incompatible, cannot calculate cost
          console.warn(`Cannot convert ${line.unit} to ${ingredient.unit} for ingredient ${ingredient.name}`)
          return null
        }
        convertedQty = converted
      }

      totalCost += ingredientCost * convertedQty

    } else if (line.subMenuItemId) {
      // Nested menu item line - recursively get cost
      const subItemCost = await getMenuItemCost(line.subMenuItemId, orgId, visited)
      
      if (subItemCost === null) {
        // Cannot calculate cost if sub-item has no cost
        return null
      }

      totalCost += subItemCost * qty
    }
  }

  // Apply wastage percentage (increases cost)
  const wastagePct = parseFloat(recipe.wastagePct)
  if (wastagePct > 0) {
    totalCost *= (1 + wastagePct / 100)
  }

  // Apply yield (cost per unit produced)
  const yieldQty = parseFloat(recipe.yieldQty)
  if (yieldQty > 0 && yieldQty !== 1) {
    totalCost /= yieldQty
  }

  return Math.round(totalCost)
}

/**
 * Calculate food cost percentage for a menu item
 * Returns percentage (0-100) or null if cannot be calculated
 */
export async function getFoodCostPercentage(menuItemId: string, orgId: string): Promise<number | null> {
  const cost = await getMenuItemCost(menuItemId, orgId)
  if (cost === null) return null

  const [item] = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.id, menuItemId), eq(menuItems.orgId, orgId)))
    .limit(1)

  if (!item || item.priceCents === 0) return null

  return (cost / item.priceCents) * 100
}

interface GetIngredientUnitCostCentsSnapshotParams {
  venueId: string;
  ingredientId: string;
  at: Date;
}

/**
 * Get the per-base-unit cost (in cents) for an ingredient at a specific date.
 * Used for waste event costing to capture the cost at the time of the event.
 * Strategy (first hit wins):
 * 1. Latest received purchase order line at/before the date
 * 2. Preferred supplier (ingredientSuppliers where isPreferred=true)
 * 3. Fallback to ingredients.costPerUnitCents
 */
export async function getIngredientUnitCostCentsSnapshot(
  params: GetIngredientUnitCostCentsSnapshotParams
): Promise<number | null> {
  const { venueId, ingredientId, at } = params;

  // Strategy 1: Latest received PO line at/before date
  const latestPOLine = await db
    .select({
      packCostCents: purchaseOrderLines.packCostCents,
      baseQtyPerPack: purchaseOrderLines.baseQtyPerPack,
    })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.poId))
    .where(
      and(
        eq(purchaseOrderLines.ingredientId, ingredientId),
        eq(purchaseOrders.venueId, venueId),
        eq(purchaseOrders.status, "RECEIVED"),
        lte(purchaseOrders.receivedAt, at)
      )
    )
    .orderBy(desc(purchaseOrders.receivedAt))
    .limit(1);

  if (latestPOLine.length > 0) {
    const { packCostCents, baseQtyPerPack } = latestPOLine[0];
    // Cost per base unit = pack cost / base qty per pack
    return Math.round(packCostCents / baseQtyPerPack);
  }

  // Strategy 2: Preferred supplier
  const preferredSupplier = await db
    .select({
      unitPriceCents: ingredientSuppliers.unitPriceCents,
    })
    .from(ingredientSuppliers)
    .where(
      and(
        eq(ingredientSuppliers.ingredientId, ingredientId),
        eq(ingredientSuppliers.isPreferred, true)
      )
    )
    .limit(1);

  if (preferredSupplier.length > 0) {
    return preferredSupplier[0].unitPriceCents;
  }

  // Strategy 3: Fallback to ingredient.costPerUnitCents
  const ingredient = await db
    .select({
      costPerUnitCents: ingredients.costPerUnitCents,
    })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId))
    .limit(1);

  if (ingredient.length > 0) {
    return ingredient[0].costPerUnitCents;
  }

  return null;
}
