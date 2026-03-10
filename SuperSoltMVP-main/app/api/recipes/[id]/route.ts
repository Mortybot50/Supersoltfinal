import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { recipes, recipeLines, menuItems } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { updateRecipeSchema } from "@/lib/inventory-schemas"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const validated = updateRecipeSchema.parse(body)

    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.orgId, orgId)))
      .limit(1)

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
    }

    const updateData: Partial<typeof recipes.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (validated.yieldQty !== undefined) updateData.yieldQty = validated.yieldQty.toString()
    if (validated.yieldUnit !== undefined) updateData.yieldUnit = validated.yieldUnit || null
    if (validated.wastagePct !== undefined) updateData.wastagePct = validated.wastagePct.toString()

    const [updated] = await db
      .update(recipes)
      .set(updateData)
      .where(eq(recipes.id, params.id))
      .returning()

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating recipe:", error)
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager"])

    const [recipe] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, params.id), eq(recipes.orgId, orgId)))
      .limit(1)

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 })
    }

    // Delete recipe (cascade will delete lines)
    await db.delete(recipes).where(eq(recipes.id, params.id))

    // Update menu item isComposite flag
    await db
      .update(menuItems)
      .set({ isComposite: false, updatedAt: new Date() })
      .where(eq(menuItems.id, recipe.menuItemId))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting recipe:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
