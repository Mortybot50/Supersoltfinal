import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { timesheets, staff } from "@/db/schema"
import { withAudit } from "@/lib/authz"
import { eq } from "drizzle-orm"

interface ClockInBody {
  staffId: string
  venueId: string
  lat?: number
  lng?: number
  pin?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ClockInBody = await request.json()
    const { staffId, venueId, lat, lng } = body

    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not set" },
        { status: 401 }
      )
    }

    // Verify staff belongs to same org and venue
    const [staffMember] = await db
      .select()
      .from(staff)
      .where(eq(staff.id, staffId))
      .limit(1)

    if (!staffMember) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      )
    }

    if (staffMember.orgId !== orgId) {
      return NextResponse.json(
        { error: "Staff member does not belong to this organization" },
        { status: 403 }
      )
    }

    if (staffMember.venueId !== venueId) {
      return NextResponse.json(
        { error: "Staff member does not belong to this venue" },
        { status: 403 }
      )
    }

    // Determine source based on presence of lat/lng
    const source = lat !== undefined && lng !== undefined ? "mobile" : "pin"

    // Create timesheet
    const [newTimesheet] = await db
      .insert(timesheets)
      .values({
        orgId,
        venueId,
        staffId,
        clockInTs: new Date(),
        source,
        status: "pending",
      })
      .returning()

    // Audit log
    await withAudit("timesheet.clock_in", null, newTimesheet, orgId, request)

    return NextResponse.json({ timesheetId: newTimesheet.id }, { status: 201 })
  } catch (error) {
    console.error("Error in clock-in:", error)
    return NextResponse.json(
      { error: "Failed to clock in" },
      { status: 500 }
    )
  }
}
