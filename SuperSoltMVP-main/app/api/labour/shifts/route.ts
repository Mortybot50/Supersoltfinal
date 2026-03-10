import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { shifts, rosters, staff } from "@/db/schema"
import { requireRole, withAudit } from "@/lib/authz"
import { eq } from "drizzle-orm"

interface CreateShiftBody {
  rosterId: string
  staffId: string
  roleTitle: string
  startTs: string
  endTs: string
  breakMinutes?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateShiftBody = await request.json()
    const { rosterId, staffId, roleTitle, startTs, endTs, breakMinutes } = body

    if (!rosterId || !staffId || !roleTitle || !startTs || !endTs) {
      return NextResponse.json(
        { error: "Missing required fields: rosterId, staffId, roleTitle, startTs, endTs" },
        { status: 400 }
      )
    }

    // Get the roster to find the orgId
    const [roster] = await db
      .select()
      .from(rosters)
      .where(eq(rosters.id, rosterId))
      .limit(1)

    if (!roster) {
      return NextResponse.json(
        { error: "Roster not found" },
        { status: 404 }
      )
    }

    // Read orgId from cookie to verify it matches
    const cookieStore = await cookies()
    const cookieOrgId = cookieStore.get("orgId")?.value

    if (!cookieOrgId || cookieOrgId !== roster.orgId) {
      return NextResponse.json(
        { error: "Organization mismatch" },
        { status: 403 }
      )
    }

    // Check that the user has owner or manager role
    await requireRole(roster.orgId, ["owner", "manager"])

    // Verify that the staff member belongs to the same org and venue
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

    if (staffMember.orgId !== roster.orgId) {
      return NextResponse.json(
        { error: "Staff member does not belong to this organization" },
        { status: 403 }
      )
    }

    if (staffMember.venueId !== roster.venueId) {
      return NextResponse.json(
        { error: "Staff member does not belong to this venue" },
        { status: 403 }
      )
    }

    // Create the shift
    const [newShift] = await db
      .insert(shifts)
      .values({
        rosterId,
        staffId,
        roleTitle,
        startTs: new Date(startTs),
        endTs: new Date(endTs),
        breakMinutes: breakMinutes || 0,
      })
      .returning()

    // Create audit log
    await withAudit(
      "shift.created",
      null,
      {
        id: newShift.id,
        rosterId: newShift.rosterId,
        staffId: newShift.staffId,
        roleTitle: newShift.roleTitle,
        startTs: newShift.startTs.toISOString(),
        endTs: newShift.endTs.toISOString(),
        breakMinutes: newShift.breakMinutes,
      },
      roster.orgId,
      request
    )

    return NextResponse.json(newShift, { status: 201 })
  } catch (error: unknown) {
    const err = error as Error
    if (err.message?.includes("Unauthorized") || err.message?.includes("Forbidden")) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("Error creating shift:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
