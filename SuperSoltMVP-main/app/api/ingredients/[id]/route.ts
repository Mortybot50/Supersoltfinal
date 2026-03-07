import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { ingredients } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { updateIngredientSchema } from "@/lib/inventory-schemas"

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
    const validated = updateIngredientSchema.parse(body)

    const updateData: Partial<typeof ingredients.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.unit !== undefined) updateData.unit = validated.unit
    if (validated.costPerUnitCents !== undefined) updateData.costPerUnitCents = validated.costPerUnitCents
    if (validated.currentStockLevel !== undefined) updateData.currentStockLevel = validated.currentStockLevel
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive

    const [updated] = await db
      .update(ingredients)
      .set(updateData)
      .where(and(eq(ingredients.id, params.id), eq(ingredients.orgId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating ingredient:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to update ingredient" }, { status })
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

    const [deleted] = await db
      .delete(ingredients)
      .where(and(eq(ingredients.id, params.id), eq(ingredients.orgId, orgId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting ingredient:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to delete ingredient" }, { status })
  }
}
