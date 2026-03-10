import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { dailySales, menuItems, type NewDailySale } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireOrg, requireRole } from "@/lib/authz"

interface CSVRow {
  date: string
  menuItemName: string
  quantity: number
}

function parseCSV(csvText: string, columnMapping: { date: string; menuItem: string; quantity: string }): CSVRow[] {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row")
  }

  const headers = lines[0].split(',').map(h => h.trim())
  
  const dateIdx = headers.indexOf(columnMapping.date)
  const menuItemIdx = headers.indexOf(columnMapping.menuItem)
  const quantityIdx = headers.indexOf(columnMapping.quantity)

  if (dateIdx === -1 || menuItemIdx === -1 || quantityIdx === -1) {
    throw new Error(`Required columns not found. Expected: "${columnMapping.date}", "${columnMapping.menuItem}", "${columnMapping.quantity}"`)
  }

  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(',').map(v => v.trim())
    
    const date = values[dateIdx]
    const menuItemName = values[menuItemIdx]
    const quantity = parseInt(values[quantityIdx], 10)

    if (!date || !menuItemName || isNaN(quantity)) {
      throw new Error(`Invalid data on row ${i + 1}`)
    }

    rows.push({ date, menuItemName, quantity })
  }

  return rows
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value
    const venueId = cookieStore.get("venueId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    if (!venueId) {
      return NextResponse.json({ error: "No venue selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager", "supervisor"])

    const body = await request.json()
    const { csvData, columnMapping = { date: "Date", menuItem: "Menu Item", quantity: "Quantity" } } = body

    if (!csvData) {
      return NextResponse.json({ error: "CSV data is required" }, { status: 400 })
    }

    // Parse CSV
    const rows = parseCSV(csvData, columnMapping)

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 400 })
    }

    // Get all menu items for this org to match by name
    const allMenuItems = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.orgId, orgId), eq(menuItems.isActive, true)))

    const menuItemsByName = new Map(
      allMenuItems.map(item => [item.name.toLowerCase(), item])
    )

    const created: any[] = []
    const errors: string[] = []

    for (const row of rows) {
      const menuItem = menuItemsByName.get(row.menuItemName.toLowerCase())
      
      if (!menuItem) {
        errors.push(`Menu item "${row.menuItemName}" not found`)
        continue
      }

      // Validate date format (YYYY-MM-DD)
      const dateMatch = row.date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!dateMatch) {
        errors.push(`Invalid date format for "${row.menuItemName}": ${row.date} (expected YYYY-MM-DD)`)
        continue
      }

      try {
        // Check if record already exists
        const [existing] = await db
          .select()
          .from(dailySales)
          .where(
            and(
              eq(dailySales.venueId, venueId),
              eq(dailySales.menuItemId, menuItem.id),
              eq(dailySales.saleDate, row.date)
            )
          )
          .limit(1)

        if (existing) {
          // Update existing record (upsert behavior)
          const [updated] = await db
            .update(dailySales)
            .set({ quantitySold: row.quantity })
            .where(eq(dailySales.id, existing.id))
            .returning()

          created.push(updated)
        } else {
          // Insert new record
          const newSale: NewDailySale = {
            orgId,
            venueId,
            saleDate: row.date,
            menuItemId: menuItem.id,
            quantitySold: row.quantity,
          }

          const [inserted] = await db.insert(dailySales).values(newSale).returning()
          created.push(inserted)
        }
      } catch (error: any) {
        errors.push(`Error processing "${row.menuItemName}" on ${row.date}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported: created.length,
      errors,
      created,
    })
  } catch (error: any) {
    console.error("Error importing CSV sales:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
