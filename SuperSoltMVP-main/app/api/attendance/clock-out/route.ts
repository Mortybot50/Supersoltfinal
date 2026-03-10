import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { timesheets } from "@/db/schema"
import { requireRole, getSessionUser, withAudit } from "@/lib/authz"
import { eq } from "drizzle-orm"

interface ClockOutBody {
  timesheetId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ClockOutBody = await request.json()
    const { timesheetId } = body

    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not set" },
        { status: 401 }
      )
    }

    // Get the existing timesheet
    const [existingTimesheet] = await db
      .select()
      .from(timesheets)
      .where(eq(timesheets.id, timesheetId))
      .limit(1)

    if (!existingTimesheet) {
      return NextResponse.json(
        { error: "Timesheet not found" },
        { status: 404 }
      )
    }

    if (existingTimesheet.orgId !== orgId) {
      return NextResponse.json(
        { error: "Timesheet does not belong to this organization" },
        { status: 403 }
      )
    }

    // Check authorization: either has manager role OR is the same staff member
    // For MVP, we'll allow manager roles only
    // In production, you'd also check if sessionUser.staffId === existingTimesheet.staffId
    try {
      await requireRole(orgId, ["owner", "manager", "supervisor"])
    } catch (error) {
      return NextResponse.json(
        { error: "Not authorized to clock out this timesheet" },
        { status: 403 }
      )
    }

    // Update timesheet with clock out time
    const [updatedTimesheet] = await db
      .update(timesheets)
      .set({ clockOutTs: new Date() })
      .where(eq(timesheets.id, timesheetId))
      .returning()

    // Audit log
    await withAudit(
      "timesheet.clock_out",
      existingTimesheet,
      updatedTimesheet,
      orgId,
      request
    )

    return NextResponse.json(updatedTimesheet, { status: 200 })
  } catch (error) {
    console.error("Error in clock-out:", error)
    return NextResponse.json(
      { error: "Failed to clock out" },
      { status: 500 }
    )
  }
}
