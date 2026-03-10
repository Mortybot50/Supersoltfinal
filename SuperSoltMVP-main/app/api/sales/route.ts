import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { dailySales, menuItems, type NewDailySale } from "@/db/schema"
import { eq, and, gte, lte, sql } from "drizzle-orm"
import { getActiveContext, requireRole } from "@/lib/authz"
import { createDailySaleSchema } from "@/lib/inventory-schemas"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { orgId, venueId } = await getActiveContext()

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const conditions = [eq(dailySales.orgId, orgId)]
    if (venueId) {
      conditions.push(eq(dailySales.venueId, venueId))
    }
    if (startDate) {
      conditions.push(gte(dailySales.saleDate, startDate))
    }
    if (endDate) {
      conditions.push(lte(dailySales.saleDate, endDate))
    }

    const items = await db
      .select({
        id: dailySales.id,
        orgId: dailySales.orgId,
        venueId: dailySales.venueId,
        saleDate: dailySales.saleDate,
        menuItemId: dailySales.menuItemId,
        quantitySold: dailySales.quantitySold,
        createdAt: dailySales.createdAt,
        menuItemName: menuItems.name,
        menuItemPrice: menuItems.priceCents,
      })
      .from(dailySales)
      .innerJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(and(...conditions))
      .orderBy(dailySales.saleDate)

    return NextResponse.json(items)
  } catch (error: any) {
    console.error("Error fetching sales:", error)
    const status = error.statusCode || 500
    const message = error.message || "Failed to fetch sales"
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId, venueId } = await getActiveContext()
    
    await requireRole(orgId, ["owner", "manager", "supervisor"])

    const body = await request.json()
    const validated = createDailySaleSchema.parse(body)

    const [menuItem] = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, validated.menuItemId), eq(menuItems.orgId, orgId)))
      .limit(1)

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 })
    }

    const newSale: NewDailySale = {
      orgId,
      venueId,
      saleDate: validated.saleDate,
      menuItemId: validated.menuItemId,
      quantitySold: validated.quantitySold,
    }

    // Upsert: if record exists for this venue+menuItem+date, add to quantity
    const [created] = await db.insert(dailySales)
      .values(newSale)
      .onConflictDoUpdate({
        target: [dailySales.venueId, dailySales.menuItemId, dailySales.saleDate],
        set: {
          quantitySold: sql`${dailySales.quantitySold} + ${validated.quantitySold}`
        }
      })
      .returning()

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error("Error creating sale:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to create sale" }, { status })
  }
}
