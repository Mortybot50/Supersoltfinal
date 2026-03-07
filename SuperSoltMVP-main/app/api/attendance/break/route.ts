import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { timesheets } from "@/db/schema"
import { withAudit } from "@/lib/authz"
import { eq } from "drizzle-orm"

interface BreakBody {
  timesheetId: string
  action: "start" | "end"
  minutes?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: BreakBody = await request.json()
    const { timesheetId, action, minutes } = body

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

    let updatedTimesheet = existingTimesheet

    if (action === "end") {
      // Add minutes to breakMinutes
      const additionalMinutes = minutes || 0
      const newBreakMinutes = existingTimesheet.breakMinutes + additionalMinutes

      const [updated] = await db
        .update(timesheets)
        .set({ breakMinutes: newBreakMinutes })
        .where(eq(timesheets.id, timesheetId))
        .returning()

      updatedTimesheet = updated
    }

    // Audit log for both start and end
    await withAudit(
      `timesheet.break_${action}`,
      existingTimesheet,
      updatedTimesheet,
      orgId,
      request
    )

    return NextResponse.json(updatedTimesheet, { status: 200 })
  } catch (error) {
    console.error("Error in break:", error)
    return NextResponse.json(
      { error: "Failed to process break" },
      { status: 500 }
    )
  }
}
