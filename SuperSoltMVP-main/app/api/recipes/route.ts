import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { recipes, recipeLines, menuItems, ingredients, type NewRecipe } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireOrg, requireRole } from "@/lib/authz"
import { createRecipeSchema } from "@/lib/inventory-schemas"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireOrg(orgId)

    const { searchParams } = new URL(request.url)
    const menuItemId = searchParams.get("menuItemId")

    if (menuItemId) {
      // Get specific recipe with its lines
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.orgId, orgId), eq(recipes.menuItemId, menuItemId)))
        .limit(1)

      if (!recipe) {
        return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
      }

      // Get recipe lines with joined data
      const lines = await db
        .select({
          id: recipeLines.id,
          orgId: recipeLines.orgId,
          recipeId: recipeLines.recipeId,
          ingredientId: recipeLines.ingredientId,
          subMenuItemId: recipeLines.subMenuItemId,
          qty: recipeLines.qty,
          unit: recipeLines.unit,
          notes: recipeLines.notes,
          createdAt: recipeLines.createdAt,
          ingredientName: ingredients.name,
          ingredientUnit: ingredients.unit,
          subMenuItemName: menuItems.name,
        })
        .from(recipeLines)
        .leftJoin(ingredients, eq(recipeLines.ingredientId, ingredients.id))
        .leftJoin(menuItems, eq(recipeLines.subMenuItemId, menuItems.id))
        .where(eq(recipeLines.recipeId, recipe.id))

      return NextResponse.json({ ...recipe, lines })
    } else {
      // Get all recipes for org
      const allRecipes = await db
        .select({
          id: recipes.id,
          orgId: recipes.orgId,
          menuItemId: recipes.menuItemId,
          yieldQty: recipes.yieldQty,
          yieldUnit: recipes.yieldUnit,
          wastagePct: recipes.wastagePct,
          createdAt: recipes.createdAt,
          updatedAt: recipes.updatedAt,
          menuItemName: menuItems.name,
        })
        .from(recipes)
        .leftJoin(menuItems, eq(recipes.menuItemId, menuItems.id))
        .where(eq(recipes.orgId, orgId))

      return NextResponse.json(allRecipes)
    }
  } catch (error: any) {
    console.error("Error fetching recipes:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const validated = createRecipeSchema.parse(body)

    // Verify menu item exists and belongs to org
    const [menuItem] = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, validated.menuItemId), eq(menuItems.orgId, orgId)))
      .limit(1)

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    // Check if recipe already exists (upsert behavior)
    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.orgId, orgId), eq(recipes.menuItemId, validated.menuItemId)))
      .limit(1)

    if (existing) {
      // Update existing recipe
      const [updated] = await db
        .update(recipes)
        .set({
          yieldQty: validated.yieldQty?.toString() || "1",
          yieldUnit: validated.yieldUnit || null,
          wastagePct: validated.wastagePct?.toString() || "0",
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, existing.id))
        .returning()

      return NextResponse.json(updated)
    } else {
      // Create new recipe
      const newRecipe: NewRecipe = {
        orgId,
        menuItemId: validated.menuItemId,
        yieldQty: validated.yieldQty?.toString() || "1",
        yieldUnit: validated.yieldUnit || null,
        wastagePct: validated.wastagePct?.toString() || "0",
      }

      const [created] = await db.insert(recipes).values(newRecipe).returning()

      // Update menu item isComposite flag
      await db
        .update(menuItems)
        .set({ isComposite: true, updatedAt: new Date() })
        .where(eq(menuItems.id, validated.menuItemId))

      return NextResponse.json(created, { status: 201 })
    }
  } catch (error: any) {
    console.error("Error creating/updating recipe:", error)
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
