import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { recipeLines } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { updateRecipeLineSchema } from "@/lib/inventory-schemas"

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
    const validated = updateRecipeLineSchema.parse(body)

    const updateData: Partial<typeof recipeLines.$inferInsert> = {}
    if (validated.qty !== undefined) updateData.qty = validated.qty.toString()
    if (validated.unit !== undefined) updateData.unit = validated.unit
    if (validated.notes !== undefined) updateData.notes = validated.notes || null

    const [updated] = await db
      .update(recipeLines)
      .set(updateData)
      .where(and(eq(recipeLines.id, params.id), eq(recipeLines.orgId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Recipe line not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating recipe line:", error)
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
      .delete(recipeLines)
      .where(and(eq(recipeLines.id, params.id), eq(recipeLines.orgId, orgId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Recipe line not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting recipe line:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
