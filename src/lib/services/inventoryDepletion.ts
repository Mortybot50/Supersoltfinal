/**
 * Inventory Depletion Engine
 *
 * Calculates theoretical ingredient usage from sales data.
 * For each order item sold → menu item → recipe → recipe_ingredients →
 * deduct theoretical quantities from ingredient stock.
 */

import type { OrderItem, MenuItem, Recipe, RecipeIngredient, Ingredient } from '@/types'

export interface DepletionResult {
  /** Ingredient-level depletion summary */
  depletions: Array<{
    ingredientId: string
    ingredientName: string
    unit: string
    quantityUsed: number
    previousStock: number
    newTheoreticalStock: number
  }>
  /** Order items that couldn't be depleted (no recipe link) */
  unmatchedItems: Array<{
    menuItemName: string
    quantity: number
    reason: string
  }>
  totalItemsDepleted: number
  totalItemsUnmatched: number
}

/**
 * Calculate theoretical ingredient depletion from a batch of order items.
 * Returns the depletion summary and updated ingredients (does NOT mutate originals).
 */
export function calculateDepletion(
  orderItems: OrderItem[],
  menuItems: MenuItem[],
  recipes: Recipe[],
  recipeIngredients: RecipeIngredient[],
  ingredients: Ingredient[]
): DepletionResult {
  const depletionMap = new Map<string, { quantity: number; ingredient: Ingredient }>()
  const unmatchedItems: DepletionResult['unmatchedItems'] = []

  for (const oi of orderItems) {
    const menuItem = menuItems.find((mi) => mi.id === oi.menu_item_id)
    if (!menuItem) {
      unmatchedItems.push({
        menuItemName: oi.menu_item_name || oi.menu_item_id,
        quantity: oi.quantity,
        reason: 'Menu item not found',
      })
      continue
    }

    if (!menuItem.recipe_id) {
      unmatchedItems.push({
        menuItemName: menuItem.name,
        quantity: oi.quantity,
        reason: 'No recipe linked',
      })
      continue
    }

    const recipe = recipes.find((r) => r.id === menuItem.recipe_id)
    if (!recipe) {
      unmatchedItems.push({
        menuItemName: menuItem.name,
        quantity: oi.quantity,
        reason: 'Recipe not found',
      })
      continue
    }

    const recipeLines = recipeIngredients.filter(
      (ri) => ri.recipe_id === recipe.id && !ri.is_sub_recipe
    )

    if (recipeLines.length === 0) {
      unmatchedItems.push({
        menuItemName: menuItem.name,
        quantity: oi.quantity,
        reason: 'Recipe has no ingredients',
      })
      continue
    }

    // For each recipe ingredient, calculate depletion
    // quantity_per_serve = recipe_ingredient.quantity / recipe.serves
    // total_depletion = quantity_per_serve * order_item.quantity
    const serves = recipe.serves > 0 ? recipe.serves : 1

    for (const ri of recipeLines) {
      const ingredient = ingredients.find((ing) => ing.id === ri.product_id)
      if (!ingredient) continue

      const quantityPerServe = ri.quantity / serves
      const totalDepletion = quantityPerServe * oi.quantity

      const existing = depletionMap.get(ingredient.id)
      if (existing) {
        existing.quantity += totalDepletion
      } else {
        depletionMap.set(ingredient.id, {
          quantity: totalDepletion,
          ingredient,
        })
      }
    }
  }

  // Build result
  const depletions: DepletionResult['depletions'] = []
  for (const [ingredientId, { quantity, ingredient }] of depletionMap) {
    depletions.push({
      ingredientId,
      ingredientName: ingredient.name,
      unit: ingredient.unit,
      quantityUsed: Math.round(quantity * 1000) / 1000, // 3 decimal precision
      previousStock: ingredient.current_stock,
      newTheoreticalStock: Math.round((ingredient.current_stock - quantity) * 1000) / 1000,
    })
  }

  return {
    depletions: depletions.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName)),
    unmatchedItems,
    totalItemsDepleted: depletions.length,
    totalItemsUnmatched: unmatchedItems.length,
  }
}

/**
 * Apply depletion results to ingredients array (returns new array, doesn't mutate).
 */
export function applyDepletionToIngredients(
  depletionResult: DepletionResult,
  ingredients: Ingredient[]
): Ingredient[] {
  const depletionMap = new Map(
    depletionResult.depletions.map((d) => [d.ingredientId, d.quantityUsed])
  )

  return ingredients.map((ing) => {
    const used = depletionMap.get(ing.id)
    if (!used) return ing
    return {
      ...ing,
      current_stock: Math.round((ing.current_stock - used) * 1000) / 1000,
    }
  })
}
