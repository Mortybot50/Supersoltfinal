import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { rosters, staff, shifts } from "@/db/schema"
import { requireOrg } from "@/lib/authz"
import { eq, and } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const weekStart = searchParams.get("weekStart")
    const venueIdParam = searchParams.get("venueId")

    // Read orgId and venueId from cookies (using active context cookies)
    const cookieStore = await cookies()
    const orgId = cookieStore.get("activeOrgId")?.value
    const venueIdCookie = cookieStore.get("activeVenueId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing activeOrgId cookie. Set active organization first." },
        { status: 400 }
      )
    }

    // Verify membership
    await requireOrg(orgId)

    // Use venueId from query param or cookie
    const venueId = venueIdParam || venueIdCookie

    // Require venueId
    if (!venueId) {
      return NextResponse.json(
        { error: "Missing activeVenueId (set it via /api/session/active-venue)" },
        { status: 400 }
      )
    }

    // Require weekStart
    if (!weekStart) {
      return NextResponse.json(
        { error: "Missing weekStart query parameter (format: YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    // Find or create roster for this org+venue+week
    let roster = await db
      .select()
      .from(rosters)
      .where(
        and(
          eq(rosters.orgId, orgId),
          eq(rosters.venueId, venueId),
          eq(rosters.weekStartDate, weekStart)
        )
      )
      .limit(1)
      .then((rows) => rows[0] || null)

    // Create roster if it doesn't exist
    if (!roster) {
      const [newRoster] = await db
        .insert(rosters)
        .values({
          orgId,
          venueId,
          weekStartDate: weekStart,
        })
        .returning()
      roster = newRoster
    }

    // Fetch staff for this org+venue
    const staffMembers = await db
      .select()
      .from(staff)
      .where(
        and(
          eq(staff.orgId, orgId),
          eq(staff.venueId, venueId)
        )
      )

    // Fetch shifts for this roster
    const rosterShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.rosterId, roster.id))

    return NextResponse.json({
      roster,
      staff: staffMembers,
      shifts: rosterShifts,
    })
  } catch (error: unknown) {
    const err = error as Error
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("Error fetching roster:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
