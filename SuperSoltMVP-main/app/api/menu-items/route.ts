import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { menuItems, type NewMenuItem } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireOrg, requireRole } from "@/lib/authz"
import { createMenuItemSchema } from "@/lib/inventory-schemas"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireOrg(orgId)

    const items = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.orgId, orgId))
      .orderBy(menuItems.name)

    return NextResponse.json(items)
  } catch (error: any) {
    console.error("Error fetching menu items:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to fetch menu items" }, { status })
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
    const validated = createMenuItemSchema.parse(body)

    const newItem: NewMenuItem = {
      orgId,
      name: validated.name,
      priceCents: validated.priceCents,
      isActive: validated.isActive,
    }

    const [created] = await db.insert(menuItems).values(newItem).returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error("Error creating menu item:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to create menu item" }, { status })
  }
}
