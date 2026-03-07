import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { timesheets, staff } from "@/db/schema"
import { eq, and, gte, lte, desc } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get("weekStart")
    const venueIdParam = searchParams.get("venueId")

    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value
    const venueIdCookie = cookieStore.get("venueId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not set" },
        { status: 401 }
      )
    }

    // Use venueId from query param or cookie
    const venueId = venueIdParam || venueIdCookie

    if (!venueId) {
      return NextResponse.json(
        { error: "Missing venueId (set it via /api/session/active-venue)" },
        { status: 400 }
      )
    }

    // Build query conditions
    const conditions = [
      eq(timesheets.orgId, orgId),
      eq(timesheets.venueId, venueId),
    ]

    // If weekStart is provided, filter by that week
    if (weekStart) {
      const startDate = new Date(weekStart)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 7)

      conditions.push(gte(timesheets.clockInTs, startDate))
      conditions.push(lte(timesheets.clockInTs, endDate))
    }

    // Fetch timesheets with staff information
    const results = await db
      .select({
        timesheet: timesheets,
        staff: staff,
      })
      .from(timesheets)
      .leftJoin(staff, eq(timesheets.staffId, staff.id))
      .where(and(...conditions))
      .orderBy(desc(timesheets.clockInTs))
      .limit(200)

    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    console.error("Error fetching timesheets:", error)
    return NextResponse.json(
      { error: "Failed to fetch timesheets" },
      { status: 500 }
    )
  }
}
