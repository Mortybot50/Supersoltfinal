import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { timesheets } from "@/db/schema"
import { requireRole, withAudit } from "@/lib/authz"
import { eq } from "drizzle-orm"

interface ApproveBody {
  timesheetId: string
  approved: boolean
  managerNote?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ApproveBody = await request.json()
    const { timesheetId, approved, managerNote } = body

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

    // Check that the user has owner or manager role
    await requireRole(orgId, ["owner", "manager"])

    // Update timesheet status
    const newStatus = approved ? "approved" : "rejected"
    const [updatedTimesheet] = await db
      .update(timesheets)
      .set({
        status: newStatus,
        managerNote: managerNote || null,
      })
      .where(eq(timesheets.id, timesheetId))
      .returning()

    // Audit log
    await withAudit(
      "timesheet.approval",
      existingTimesheet,
      updatedTimesheet,
      orgId,
      request
    )

    return NextResponse.json(updatedTimesheet, { status: 200 })
  } catch (error) {
    console.error("Error in approve:", error)
    return NextResponse.json(
      { error: "Failed to approve timesheet" },
      { status: 500 }
    )
  }
}
