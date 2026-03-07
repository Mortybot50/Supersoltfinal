import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { suppliers } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { updateSupplierSchema } from "@/lib/inventory-schemas"

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
    const validated = updateSupplierSchema.parse(body)

    const updateData: Partial<typeof suppliers.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.contactEmail !== undefined) updateData.contactEmail = validated.contactEmail || null
    if (validated.phone !== undefined) updateData.phone = validated.phone || null
    if (validated.notes !== undefined) updateData.notes = validated.notes || null
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive

    const [updated] = await db
      .update(suppliers)
      .set(updateData)
      .where(and(eq(suppliers.id, params.id), eq(suppliers.orgId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating supplier:", error)
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

    // Soft delete
    const [deleted] = await db
      .update(suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(suppliers.id, params.id), eq(suppliers.orgId, orgId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting supplier:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
