import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { menuItems } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { updateMenuItemSchema } from "@/lib/inventory-schemas"

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
    const validated = updateMenuItemSchema.parse(body)

    const updateData: Partial<typeof menuItems.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.priceCents !== undefined) updateData.priceCents = validated.priceCents
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive

    const [updated] = await db
      .update(menuItems)
      .set(updateData)
      .where(and(eq(menuItems.id, params.id), eq(menuItems.orgId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating menu item:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to update menu item" }, { status })
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
      .delete(menuItems)
      .where(and(eq(menuItems.id, params.id), eq(menuItems.orgId, orgId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting menu item:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to delete menu item" }, { status })
  }
}
