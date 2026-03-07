import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { ingredientSuppliers } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { updateIngredientSupplierSchema } from "@/lib/inventory-schemas"

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
    const validated = updateIngredientSupplierSchema.parse(body)

    const updateData: Partial<typeof ingredientSuppliers.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (validated.packSize !== undefined) updateData.packSize = validated.packSize?.toString() || null
    if (validated.packUnit !== undefined) updateData.packUnit = validated.packUnit || null
    if (validated.unitPriceCents !== undefined) updateData.unitPriceCents = validated.unitPriceCents
    if (validated.leadTimeDays !== undefined) updateData.leadTimeDays = validated.leadTimeDays
    if (validated.sku !== undefined) updateData.sku = validated.sku || null
    if (validated.isPreferred !== undefined) updateData.isPreferred = validated.isPreferred

    const [updated] = await db
      .update(ingredientSuppliers)
      .set(updateData)
      .where(and(eq(ingredientSuppliers.id, params.id), eq(ingredientSuppliers.orgId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Ingredient supplier mapping not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating ingredient supplier:", error)
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

    const [deleted] = await db
      .delete(ingredientSuppliers)
      .where(and(eq(ingredientSuppliers.id, params.id), eq(ingredientSuppliers.orgId, orgId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Ingredient supplier mapping not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting ingredient supplier:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
