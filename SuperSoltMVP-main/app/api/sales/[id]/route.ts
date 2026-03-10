import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { dailySales } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/authz"
import { updateDailySaleSchema } from "@/lib/inventory-schemas"

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

    await requireRole(orgId, ["owner", "manager", "supervisor"])

    const body = await request.json()
    const validated = updateDailySaleSchema.parse(body)

    const [updated] = await db
      .update(dailySales)
      .set({ quantitySold: validated.quantitySold })
      .where(and(eq(dailySales.id, params.id), eq(dailySales.orgId, orgId)))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "Sale record not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Error updating sale:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to update sale" }, { status })
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
      .delete(dailySales)
      .where(and(eq(dailySales.id, params.id), eq(dailySales.orgId, orgId)))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: "Sale record not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting sale:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to delete sale" }, { status })
  }
}
