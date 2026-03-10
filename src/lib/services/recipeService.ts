/**
 * Recipe Module Supabase Service
 * Handles all database operations for recipes and recipe_ingredients
 */

import { supabase } from '@/integrations/supabase/client'
import type { Tables } from '@/integrations/supabase/types'
import type { Recipe, RecipeIngredient, Ingredient } from '@/types'

type DBRecipe = Tables<'recipes'>
type DBRecipeIngredient = Tables<'recipe_ingredients'>

// ============================================
// MAPPING: DB → App types
// ============================================

function mapDBRecipeToApp(db: DBRecipe): Recipe {
  // Parse steps from method field (stored as JSON string)
  let steps: string[] = []
  if (db.method) {
    try {
      const parsed = JSON.parse(db.method)
      steps = Array.isArray(parsed) ? parsed : [db.method]
    } catch {
      // If not valid JSON, treat as single instruction step
      steps = db.method ? [db.method] : []
    }
  }

  return {
    id: db.id,
    organization_id: db.org_id,
    name: db.name,
    category: (db.category || 'other') as Recipe['category'],
    serves: db.batch_yield || 1,
    wastage_percent: db.waste_percent ?? 0,
    gp_target_percent: db.gp_target_percent ?? 65,
    instructions: db.description || undefined,
    steps,
    allergens: db.allergens || [],
    status: (db.status || 'draft') as Recipe['status'],
    total_cost: db.cost_per_batch ?? 0,
    cost_per_serve: db.cost_per_serve ?? 0,
    suggested_price: db.suggested_price ?? 0,
    created_by: db.created_by || '',
    created_at: new Date(db.created_at),
    updated_at: new Date(db.updated_at),
  }
}

function mapDBRecipeIngredientToApp(
  db: DBRecipeIngredient,
  ingredient?: Ingredient
): RecipeIngredient {
  const isSubRecipe = (db as Record<string, unknown>).is_sub_recipe === true
  const subRecipeId = (db as Record<string, unknown>).sub_recipe_id as string | undefined
  return {
    id: db.id,
    recipe_id: db.recipe_id,
    product_id: isSubRecipe ? (subRecipeId ?? '') : (db.ingredient_id ?? ''),
    sub_recipe_id: isSubRecipe ? subRecipeId : undefined,
    is_sub_recipe: isSubRecipe,
    product_name: ingredient?.name || '',
    quantity: db.quantity,
    unit: (db.unit || 'g') as RecipeIngredient['unit'],
    cost_per_unit: ingredient?.cost_per_unit ?? 0,
    line_cost: db.cost ?? 0,
    unit_cost_ex_base: ingredient?.unit_cost_ex_base ?? 0,
    product_unit: ingredient?.unit || '',
    product_cost: ingredient?.cost_per_unit ?? 0,
  }
}

// ============================================
// LOAD OPERATIONS
// ============================================

export async function loadRecipesFromDB(): Promise<{
  recipes: Recipe[]
  recipeIngredients: RecipeIngredient[]
}> {
  // Load recipes
  const { data: recipesData, error: recipesError } = await supabase
    .from('recipes')
    .select('*')
    .order('name')

  if (recipesError) throw recipesError

  // Load all recipe ingredients with their ingredient details
  const { data: riData, error: riError } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .order('sort_order', { ascending: true })

  if (riError) throw riError

  // Load ingredients for cost/unit lookups
  const ingredientIds = [...new Set((riData || []).filter((ri) => ri.ingredient_id).map((ri) => ri.ingredient_id as string))]
  let ingredientsMap: Record<string, Ingredient> = {}

  if (ingredientIds.length > 0) {
    const { data: ingData, error: ingError } = await supabase
      .from('ingredients')
      .select('*')
      .in('id', ingredientIds)

    if (ingError) throw ingError

    ingredientsMap = (ingData || []).reduce(
      (acc, ing) => {
        acc[ing.id] = ing as unknown as Ingredient
        return acc
      },
      {} as Record<string, Ingredient>
    )
  }

  // Load sub-recipe data for lines that reference another recipe
  // Sub-recipe lines have is_sub_recipe=true and sub_recipe_id set (ingredient_id is null)
  const subRecipeIds = [
    ...new Set(
      (riData || [])
        .filter((ri) => (ri as Record<string, unknown>).is_sub_recipe === true)
        .map((ri) => (ri as Record<string, unknown>).sub_recipe_id as string)
        .filter(Boolean)
    ),
  ]
  // We already loaded all recipes above — build a quick lookup from recipesData
  const recipesData2 = recipesData || []
  const subRecipeMap: Record<string, { name: string; cost_per_serve: number }> = {}
  for (const id of subRecipeIds) {
    const r = recipesData2.find((r) => r.id === id)
    if (r) {
      subRecipeMap[id] = { name: r.name, cost_per_serve: r.cost_per_serve ?? 0 }
    }
  }

  const recipes = recipesData2.map(mapDBRecipeToApp)
  const recipeIngredients = (riData || []).map((ri) => {
    const isSubRecipe = (ri as Record<string, unknown>).is_sub_recipe === true
    if (isSubRecipe) {
      const subId = (ri as Record<string, unknown>).sub_recipe_id as string
      const subData = subRecipeMap[subId]
      // Build a synthetic ingredient-like object so the mapper can populate name & cost
      const syntheticIngredient = subData
        ? ({
            id: subId,
            name: subData.name,
            cost_per_unit: subData.cost_per_serve,
            unit_cost_ex_base: subData.cost_per_serve,
            unit: 'ea',
          } as unknown as Ingredient)
        : undefined
      const mapped = mapDBRecipeIngredientToApp(ri, syntheticIngredient)
      // Override line_cost with current sub-recipe cost × quantity (not stale stored cost)
      if (subData && ri.quantity != null) {
        mapped.line_cost = Math.round(subData.cost_per_serve * ri.quantity)
      }
      return mapped
    }
    return mapDBRecipeIngredientToApp(ri, ingredientsMap[ri.ingredient_id ?? ''])
  })

  return { recipes, recipeIngredients }
}

// ============================================
// SAVE OPERATIONS
// ============================================

export async function saveRecipeToDB(
  recipe: Recipe,
  ingredients: RecipeIngredient[],
  isNew: boolean
): Promise<void> {
  const dbRecipe = {
    id: recipe.id,
    org_id: recipe.organization_id,
    name: recipe.name,
    category: recipe.category,
    batch_yield: recipe.serves,
    waste_percent: recipe.wastage_percent,
    gp_target_percent: recipe.gp_target_percent,
    description: recipe.instructions || null,
    method: JSON.stringify(recipe.steps.filter((s) => s.trim() !== '')),
    allergens: recipe.allergens,
    status: recipe.status,
    cost_per_batch: recipe.total_cost,
    cost_per_serve: recipe.cost_per_serve,
    suggested_price: recipe.suggested_price,
    created_by: recipe.created_by || null,
  }

  if (isNew) {
    const { error } = await supabase.from('recipes').insert([dbRecipe])
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('recipes')
      .update({
        name: dbRecipe.name,
        category: dbRecipe.category,
        batch_yield: dbRecipe.batch_yield,
        waste_percent: dbRecipe.waste_percent,
        gp_target_percent: dbRecipe.gp_target_percent,
        description: dbRecipe.description,
        method: dbRecipe.method,
        allergens: dbRecipe.allergens,
        status: dbRecipe.status,
        cost_per_batch: dbRecipe.cost_per_batch,
        cost_per_serve: dbRecipe.cost_per_serve,
        suggested_price: dbRecipe.suggested_price,
      })
      .eq('id', recipe.id)
    if (error) throw error
  }

  // Replace all recipe_ingredients: delete existing, then insert new
  if (!isNew) {
    const { error: delError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipe.id)
    if (delError) throw delError
  }

  // Insert new ingredients (including sub-recipes which have is_sub_recipe=true and sub_recipe_id set)
  const validIngredients = ingredients.filter((ing) => ing.product_id || ing.is_sub_recipe)
  if (validIngredients.length > 0) {
    const dbIngredients = validIngredients.map((ing, index) => ({
      id: ing.id,
      recipe_id: recipe.id,
      ingredient_id: ing.is_sub_recipe ? null : ing.product_id,
      sub_recipe_id: ing.is_sub_recipe ? (ing.sub_recipe_id ?? ing.product_id) : null,
      quantity: ing.quantity,
      unit: ing.unit,
      cost: ing.line_cost,
      sort_order: index,
      is_sub_recipe: ing.is_sub_recipe ?? false,
    }))

    const { error: insError } = await supabase
      .from('recipe_ingredients')
      .insert(dbIngredients)
    if (insError) throw insError
  }
}

export async function deleteRecipeFromDB(recipeId: string): Promise<void> {
  // Delete recipe_ingredients first (FK constraint)
  const { error: riError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)
  if (riError) throw riError

  const { error } = await supabase.from('recipes').delete().eq('id', recipeId)
  if (error) throw error
}

export async function updateRecipeStatusInDB(
  recipeId: string,
  status: Recipe['status']
): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .update({ status })
    .eq('id', recipeId)
  if (error) throw error
}
