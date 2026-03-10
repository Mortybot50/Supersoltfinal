import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { requireOrg } from "@/lib/authz"
import { getMenuItemCost, getFoodCostPercentage } from "@/lib/costing"
import { db } from "@/db"
import { recipes, recipeLines, ingredients, menuItems } from "@/db/schema"
import { eq, and } from "drizzle-orm"

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

    if (!menuItemId) {
      return NextResponse.json({ error: "menuItemId is required" }, { status: 400 })
    }

    const warnings: string[] = []

    try {
      const costCents = await getMenuItemCost(menuItemId, orgId)
      const foodCostPct = await getFoodCostPercentage(menuItemId, orgId)

      // Get line details for debugging - filter by orgId to prevent cross-tenant leaks
      const [recipe] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.menuItemId, menuItemId), eq(recipes.orgId, orgId)))
        .limit(1)

      let lines: any[] = []
      if (recipe) {
        lines = await db
          .select({
            id: recipeLines.id,
            ingredientId: recipeLines.ingredientId,
            subMenuItemId: recipeLines.subMenuItemId,
            qty: recipeLines.qty,
            unit: recipeLines.unit,
            ingredientName: ingredients.name,
            subMenuItemName: menuItems.name,
          })
          .from(recipeLines)
          .leftJoin(ingredients, and(eq(recipeLines.ingredientId, ingredients.id), eq(ingredients.orgId, orgId)))
          .leftJoin(menuItems, and(eq(recipeLines.subMenuItemId, menuItems.id), eq(menuItems.orgId, orgId)))
          .where(and(eq(recipeLines.recipeId, recipe.id), eq(recipeLines.orgId, orgId)))
      }

      if (costCents === null) {
        warnings.push("Cost could not be calculated - missing supplier pricing or recipe data")
      }

      return NextResponse.json({
        costCents,
        foodCostPct,
        lines: lines.length,
        warnings,
      })
    } catch (error: any) {
      if (error.message?.includes("Circular dependency")) {
        return NextResponse.json({
          costCents: null,
          foodCostPct: null,
          lines: 0,
          warnings: ["Circular dependency detected in recipe - a menu item cannot include itself"],
        }, { status: 400 })
      }
      throw error
    }
  } catch (error: any) {
    console.error("Error calculating recipe cost:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
