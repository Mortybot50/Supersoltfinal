import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { timesheets, staff, venues, staffIntegrations, payItemMaps } from "@/db/schema"
import { requireOrg } from "@/lib/authz"
import { eq, and, gte, lt } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekStart = searchParams.get("weekStart")
    const systemParam = searchParams.get("system") || "xero"

    // Validate and type system
    if (!["xero", "keypay", "myob"].includes(systemParam)) {
      return NextResponse.json(
        { error: "Invalid system. Must be xero, keypay, or myob" },
        { status: 400 }
      )
    }

    const system = systemParam as "xero" | "keypay" | "myob"

    // Get cookies
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value
    const venueId = cookieStore.get("venueId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not set" },
        { status: 401 }
      )
    }

    if (!venueId) {
      return NextResponse.json(
        { error: "Venue not set" },
        { status: 400 }
      )
    }

    // Verify membership
    await requireOrg(orgId)

    if (!weekStart) {
      return NextResponse.json(
        { error: "Missing weekStart query parameter (format: YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    // Calculate week end date (exclusive - next Monday)
    const startDate = new Date(weekStart)
    const endDateExclusive = new Date(startDate)
    endDateExclusive.setDate(endDateExclusive.getDate() + 7)

    // Query approved timesheets with all necessary joins
    const results = await db
      .select({
        timesheet: timesheets,
        staff: staff,
        venue: venues,
        staffIntegration: staffIntegrations,
        payItemMap: payItemMaps,
      })
      .from(timesheets)
      .leftJoin(staff, eq(timesheets.staffId, staff.id))
      .leftJoin(venues, eq(timesheets.venueId, venues.id))
      .leftJoin(
        staffIntegrations,
        and(
          eq(staffIntegrations.staffId, timesheets.staffId),
          eq(staffIntegrations.system, system)
        )
      )
      .leftJoin(
        payItemMaps,
        and(
          eq(payItemMaps.orgId, timesheets.orgId),
          eq(payItemMaps.system, system),
          eq(payItemMaps.roleTitle, staff.roleTitle)
        )
      )
      .where(
        and(
          eq(timesheets.orgId, orgId),
          eq(timesheets.venueId, venueId),
          eq(timesheets.status, "approved"),
          gte(timesheets.clockInTs, startDate),
          lt(timesheets.clockInTs, endDateExclusive)
        )
      )

    // Count missing mappings
    let missingMappings = 0

    // Build CSV rows
    const csvRows: string[] = []
    csvRows.push(
      "EmployeeId,EmployeeName,Date,StartTimeUTC,EndTimeUTC,BreakMinutes,HoursDecimal,PayItemCode,VenueName"
    )

    for (const row of results) {
      const { timesheet, staff: staffMember, venue, staffIntegration, payItemMap } = row

      if (!staffMember || !venue || !timesheet.clockOutTs) {
        continue
      }

      // Calculate hours decimal
      const clockInMs = timesheet.clockInTs.getTime()
      const clockOutMs = timesheet.clockOutTs.getTime()
      const breakMs = timesheet.breakMinutes * 60 * 1000
      const totalMs = clockOutMs - clockInMs - breakMs
      const hoursDecimal = (totalMs / (1000 * 60 * 60)).toFixed(2)

      // Check for missing mappings
      if (!staffIntegration || !payItemMap) {
        missingMappings++
      }

      // Format dates and times
      const date = timesheet.clockInTs.toISOString().split("T")[0]
      const startTimeUTC = timesheet.clockInTs.toISOString()
      const endTimeUTC = timesheet.clockOutTs.toISOString()

      // Build CSV row
      const employeeId = staffIntegration?.externalRef || ""
      const employeeName = staffMember.name
      const payItemCode = payItemMap?.payItemCode || ""
      const venueName = venue.name

      csvRows.push(
        `${employeeId},"${employeeName}",${date},${startTimeUTC},${endTimeUTC},${timesheet.breakMinutes},${hoursDecimal},${payItemCode},"${venueName}"`
      )
    }

    // Join rows into CSV content
    const csvContent = csvRows.join("\n")

    // Create response with CSV content
    const response = new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payroll-export-${weekStart}-${system}.csv"`,
      },
    })

    // Add missing mappings header if needed
    if (missingMappings > 0) {
      response.headers.set("X-Missing-Mappings", missingMappings.toString())
    }

    return response
  } catch (error: unknown) {
    const err = error as Error
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    console.error("Error generating payroll export:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
