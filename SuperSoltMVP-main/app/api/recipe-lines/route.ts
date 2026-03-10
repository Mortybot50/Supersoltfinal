import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { recipeLines, recipes, ingredients, menuItems, type NewRecipeLine } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { createRecipeLineSchema } from "@/lib/inventory-schemas"

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const validated = createRecipeLineSchema.parse(body)

    // Verify recipe exists and belongs to org
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, validated.recipeId), eq(recipes.orgId, orgId)))
      .limit(1)

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
    }

    // If ingredient line, verify ingredient exists
    if (validated.ingredientId) {
      const [ingredient] = await db
        .select()
        .from(ingredients)
        .where(and(eq(ingredients.id, validated.ingredientId), eq(ingredients.orgId, orgId)))
        .limit(1)

      if (!ingredient) {
        return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
      }
    }

    // If sub-menu item line, verify it exists and prevent circular deps
    if (validated.subMenuItemId) {
      const [subMenuItem] = await db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.id, validated.subMenuItemId), eq(menuItems.orgId, orgId)))
        .limit(1)

      if (!subMenuItem) {
        return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
      }

      // Prevent direct circular reference
      if (validated.subMenuItemId === recipe.menuItemId) {
        return NextResponse.json({
          error: "Circular dependency: a menu item cannot include itself in its recipe"
        }, { status: 400 })
      }
    }

    const newLine: NewRecipeLine = {
      orgId,
      recipeId: validated.recipeId,
      ingredientId: validated.ingredientId || null,
      subMenuItemId: validated.subMenuItemId || null,
      qty: validated.qty.toString(),
      unit: validated.unit,
      notes: validated.notes || null,
    }

    const [created] = await db.insert(recipeLines).values(newLine).returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error("Error creating recipe line:", error)
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
