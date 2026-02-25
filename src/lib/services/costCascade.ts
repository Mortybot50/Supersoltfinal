/**
 * Cost Cascade Engine
 *
 * When an ingredient price changes:
 * 1. Update ingredient.cost_per_unit + unit_cost_ex_base
 * 2. Log to ingredient_price_history
 * 3. Recalculate all recipe_ingredients lines using this ingredient
 * 4. Recalculate each affected recipe's total_cost, cost_per_serve, suggested_price
 * 5. Update linked menu items GP%
 * 6. Return list of affected items + GP% alerts
 */

import { supabase } from '@/integrations/supabase/client'
import type { Ingredient, Recipe, RecipeIngredient, MenuItem } from '@/types'
import { calculateLineCost, calculateCostPerBaseUnit } from '@/lib/utils/unitConversions'

export interface CascadeResult {
  ingredientId: string
  ingredientName: string
  oldCostCents: number | null
  newCostCents: number
  affectedRecipes: Array<{
    recipeId: string
    recipeName: string
    oldCostPerServe: number
    newCostPerServe: number
  }>
  gpAlerts: Array<{
    menuItemId: string
    menuItemName: string
    newGpPercent: number
    targetGpPercent: number
  }>
}

/**
 * Log a price change to ingredient_price_history
 */
export async function logPriceChange(
  ingredientId: string,
  oldCostCents: number | null,
  newCostCents: number,
  source: 'manual' | 'invoice' | 'import' | 'bulk_update' = 'manual'
): Promise<void> {
  const { error } = await supabase
    .from('ingredient_price_history')
    .insert({
      ingredient_id: ingredientId,
      old_cost_cents: oldCostCents,
      new_cost_cents: newCostCents,
      source,
    })
  if (error) {
    console.error('Failed to log price change:', error)
  }
}

/**
 * Fetch price history for an ingredient (most recent first)
 */
export async function fetchPriceHistory(
  ingredientId: string,
  limit = 20
): Promise<Array<{ old_cost_cents: number | null; new_cost_cents: number; changed_at: string; source: string }>> {
  const { data, error } = await supabase
    .from('ingredient_price_history')
    .select('old_cost_cents, new_cost_cents, changed_at, source')
    .eq('ingredient_id', ingredientId)
    .order('changed_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('Failed to fetch price history:', error)
    return []
  }
  return data || []
}

/**
 * Run the full cost cascade after an ingredient price change.
 * Updates store state directly — call this AFTER the ingredient is saved to DB.
 */
export function runCostCascade(
  ingredientId: string,
  newCostPerUnit: number,
  newUnitCostExBase: number,
  ingredients: Ingredient[],
  recipes: Recipe[],
  recipeIngredients: RecipeIngredient[],
  menuItems: MenuItem[],
  gpThreshold: number
): CascadeResult {
  const ingredient = ingredients.find((i) => i.id === ingredientId)
  if (!ingredient) {
    return { ingredientId, ingredientName: '', oldCostCents: null, newCostCents: newCostPerUnit, affectedRecipes: [], gpAlerts: [] }
  }

  const result: CascadeResult = {
    ingredientId,
    ingredientName: ingredient.name,
    oldCostCents: ingredient.cost_per_unit,
    newCostCents: newCostPerUnit,
    affectedRecipes: [],
    gpAlerts: [],
  }

  // 1. Find all recipe_ingredient lines using this ingredient
  const affectedLines = recipeIngredients.filter(
    (ri) => ri.product_id === ingredientId && !ri.is_sub_recipe
  )

  // 2. Get unique recipe IDs
  const affectedRecipeIds = [...new Set(affectedLines.map((ri) => ri.recipe_id))]

  // 3. Recalculate each affected recipe
  for (const recipeId of affectedRecipeIds) {
    const recipe = recipes.find((r) => r.id === recipeId)
    if (!recipe) continue

    const oldCostPerServe = recipe.cost_per_serve
    const allLinesForRecipe = recipeIngredients.filter((ri) => ri.recipe_id === recipeId)

    // Recalculate line costs
    let newTotalCost = 0
    for (const line of allLinesForRecipe) {
      if (line.product_id === ingredientId && !line.is_sub_recipe) {
        // This line uses the changed ingredient — recalculate
        const newLineCost = calculateLineCost(line.quantity, line.unit, newUnitCostExBase)
        newTotalCost += newLineCost
      } else {
        // Other ingredient lines — keep existing cost
        newTotalCost += line.line_cost
      }
    }

    const newCostPerServe = recipe.serves > 0 ? Math.round(newTotalCost / recipe.serves) : 0

    result.affectedRecipes.push({
      recipeId,
      recipeName: recipe.name,
      oldCostPerServe,
      newCostPerServe,
    })

    // 4. Check linked menu items
    const linkedMenuItems = menuItems.filter((mi) => mi.recipe_id === recipeId)
    for (const mi of linkedMenuItems) {
      const priceExGst = mi.gst_mode === 'INC'
        ? Math.round(mi.price / (1 + mi.gst_rate_percent / 100))
        : mi.price
      const newGpPercent = priceExGst > 0
        ? ((priceExGst - newCostPerServe) / priceExGst) * 100
        : 0

      if (newGpPercent < gpThreshold) {
        result.gpAlerts.push({
          menuItemId: mi.id,
          menuItemName: mi.name,
          newGpPercent: Math.round(newGpPercent * 10) / 10,
          targetGpPercent: mi.gp_target_percent || gpThreshold,
        })
      }
    }
  }

  return result
}

/**
 * Apply cascade results to store state.
 * Returns updated arrays that should be set() into the store.
 */
export function applyCascadeToState(
  cascadeResult: CascadeResult,
  ingredients: Ingredient[],
  recipes: Recipe[],
  recipeIngredients: RecipeIngredient[],
  menuItems: MenuItem[],
  newCostPerUnit: number,
  newUnitCostExBase: number
): {
  ingredients: Ingredient[]
  recipes: Recipe[]
  recipeIngredients: RecipeIngredient[]
  menuItems: MenuItem[]
} {
  // Update ingredient
  const updatedIngredients = ingredients.map((i) =>
    i.id === cascadeResult.ingredientId
      ? { ...i, cost_per_unit: newCostPerUnit, unit_cost_ex_base: newUnitCostExBase, last_cost_update: new Date() }
      : i
  )

  // Update recipe ingredient lines
  const updatedRecipeIngredients = recipeIngredients.map((ri) => {
    if (ri.product_id === cascadeResult.ingredientId && !ri.is_sub_recipe) {
      const newLineCost = calculateLineCost(ri.quantity, ri.unit, newUnitCostExBase)
      return {
        ...ri,
        line_cost: newLineCost,
        unit_cost_ex_base: newUnitCostExBase,
        product_cost: newCostPerUnit,
      }
    }
    return ri
  })

  // Update recipes
  const updatedRecipes = recipes.map((r) => {
    const affected = cascadeResult.affectedRecipes.find((ar) => ar.recipeId === r.id)
    if (!affected) return r
    const rLines = updatedRecipeIngredients.filter((ri) => ri.recipe_id === r.id)
    const totalCost = rLines.reduce((s, ri) => s + ri.line_cost, 0)
    const costPerServe = r.serves > 0 ? Math.round(totalCost / r.serves) : 0
    const gpMultiplier = 1 - r.gp_target_percent / 100
    const suggestedPrice = gpMultiplier > 0 ? Math.round(costPerServe / gpMultiplier) : 0
    return { ...r, total_cost: totalCost, cost_per_serve: costPerServe, suggested_price: suggestedPrice, updated_at: new Date() }
  })

  // Update menu items GP%
  const updatedMenuItems = menuItems.map((mi) => {
    const affectedRecipe = cascadeResult.affectedRecipes.find((ar) => ar.recipeId === mi.recipe_id)
    if (!affectedRecipe) return mi
    const newCostPerServe = affectedRecipe.newCostPerServe
    const priceExGst = mi.gst_mode === 'INC'
      ? Math.round(mi.price / (1 + mi.gst_rate_percent / 100))
      : mi.price
    const gpPercent = priceExGst > 0 ? ((priceExGst - newCostPerServe) / priceExGst) * 100 : 0
    return {
      ...mi,
      cost_per_serve: newCostPerServe,
      gp_percent: Math.round(gpPercent * 10) / 10,
      price_ex_gst: priceExGst,
      updated_at: new Date(),
    }
  })

  return {
    ingredients: updatedIngredients,
    recipes: updatedRecipes,
    recipeIngredients: updatedRecipeIngredients,
    menuItems: updatedMenuItems,
  }
}

/**
 * Persist cascade results to Supabase.
 * Batch-updates affected recipes and menu items after in-memory cascade.
 * Call AFTER applyCascadeToState() to sync DB with store.
 */
export async function persistCascadeResults(
  cascadeResult: CascadeResult,
  updatedRecipes: Recipe[],
  updatedMenuItems: MenuItem[]
): Promise<{ errors: string[] }> {
  const errors: string[] = []

  // Batch-update affected recipes
  const affectedRecipeIds = cascadeResult.affectedRecipes.map((ar) => ar.recipeId)
  for (const recipeId of affectedRecipeIds) {
    const recipe = updatedRecipes.find((r) => r.id === recipeId)
    if (!recipe) continue

    const { error } = await supabase
      .from('recipes')
      .update({
        total_cost: recipe.total_cost,
        cost_per_serve: recipe.cost_per_serve,
        suggested_price: recipe.suggested_price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId)

    if (error) {
      console.error(`[costCascade] Failed to persist recipe ${recipeId}:`, error)
      errors.push(`Recipe ${recipe.name}: ${error.message}`)
    }
  }

  // Update all menu items linked to affected recipes (not just GP alert ones)
  const allAffectedMenuItems = updatedMenuItems.filter((mi) =>
    affectedRecipeIds.includes(mi.recipe_id || '')
  )

  for (const mi of allAffectedMenuItems) {
    const { error } = await supabase
      .from('menu_items')
      .update({
        cost_per_serve: mi.cost_per_serve,
        gp_percent: mi.gp_percent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mi.id)

    if (error) {
      console.error(`[costCascade] Failed to persist menu item ${mi.id}:`, error)
      errors.push(`Menu item ${mi.name}: ${error.message}`)
    }
  }

  if (errors.length > 0) {
    console.warn(`[costCascade] Persisted with ${errors.length} error(s)`)
  }

  return { errors }
}
