import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { shifts, rosters, staff, venues } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";

/**
 * GET /api/workforce/payroll/export?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Export shifts as CSV for payroll systems
 * Includes staff details, hours, wage rates, and costs
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();

    // Get user's active org and venue from cookies
    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    // Verify user has manager role
    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    // Get date range from query params
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "start and end date parameters are required" }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
    }

    // Get venue name
    const venueRecord = await db
      .select({ name: venues.name })
      .from(venues)
      .where(eq(venues.id, venueId))
      .limit(1)
      .execute();

    const venueName = venueRecord.length > 0 ? venueRecord[0].name : "Unknown Venue";

    // Find all rosters in date range
    const weekStarts: string[] = [];
    const startDate = new Date(start + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");

    // Generate all Monday week starts in range
    let currentDate = new Date(startDate);
    const dayOfWeek = currentDate.getUTCDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    currentDate.setUTCDate(currentDate.getUTCDate() - daysToMonday);

    while (currentDate <= endDate) {
      weekStarts.push(currentDate.toISOString().split("T")[0]);
      currentDate.setUTCDate(currentDate.getUTCDate() + 7);
    }

    if (weekStarts.length === 0) {
      return NextResponse.json({ error: "No weeks found in date range" }, { status: 404 });
    }

    // Get all shifts in date range
    const allShifts = await db
      .select({
        shiftId: shifts.id,
        staffName: staff.name,
        staffExternalId: staff.externalId,
        roleTitle: shifts.roleTitle,
        startTs: shifts.startTs,
        endTs: shifts.endTs,
        breakMinutes: shifts.breakMinutes,
        wageRateCentsSnapshot: shifts.wageRateCentsSnapshot,
        staffHourlyRateCents: staff.hourlyRateCents,
        status: shifts.status,
      })
      .from(shifts)
      .innerJoin(rosters, eq(rosters.id, shifts.rosterId))
      .leftJoin(staff, eq(staff.id, shifts.staffId))
      .where(
        and(
          eq(rosters.orgId, orgId),
          eq(rosters.venueId, venueId),
          gte(shifts.startTs, new Date(start + "T00:00:00Z")),
          lte(shifts.startTs, new Date(end + "T23:59:59Z"))
        )
      )
      .execute();

    if (allShifts.length === 0) {
      return NextResponse.json({ error: "No shifts found in date range" }, { status: 404 });
    }

    // Build CSV
    const csvRows: string[] = [];

    // Header
    csvRows.push(
      [
        "Staff Name",
        "External ID",
        "Date",
        "Role",
        "Start Time",
        "End Time",
        "Hours Worked",
        "Wage Rate ($/hr)",
        "Cost ($)",
        "Venue",
        "Status",
      ].join(",")
    );

    // Data rows
    for (const shift of allShifts) {
      const date = shift.startTs.toISOString().split("T")[0];
      const startTime = shift.startTs.toISOString().split("T")[1].substring(0, 5); // HH:MM
      const endTime = shift.endTs.toISOString().split("T")[1].substring(0, 5);

      // Calculate hours worked
      const durationMs = shift.endTs.getTime() - shift.startTs.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      const workMinutes = durationMinutes - shift.breakMinutes;
      const hoursWorked = (workMinutes / 60).toFixed(2);

      // Get wage rate (use snapshot if available, otherwise staff rate)
      const wageRateCents = shift.wageRateCentsSnapshot || shift.staffHourlyRateCents || 0;
      const wageRate = (wageRateCents / 100).toFixed(2);

      // Calculate cost
      const costCents = Math.round(wageRateCents * parseFloat(hoursWorked));
      const cost = (costCents / 100).toFixed(2);

      csvRows.push(
        [
          `"${shift.staffName || "Unassigned"}"`,
          shift.staffExternalId || "",
          date,
          `"${shift.roleTitle}"`,
          startTime,
          endTime,
          hoursWorked,
          wageRate,
          cost,
          `"${venueName}"`,
          shift.status,
        ].join(",")
      );
    }

    const csv = csvRows.join("\n");

    // Return CSV with proper headers
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="payroll_${start}_${end}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting payroll:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export payroll" },
      { status: 500 }
    );
  }
}
