import type { Timesheet, RosterShift, Staff, Order } from "@/types";
import type {
  RoleLabourBreakdown,
  OvertimeAnalysis,
  RosterCompliance,
  LabourEfficiency,
} from "@/types/labour.types";
import { differenceInMinutes, parseISO, format } from "date-fns";

// ============================================
// CORE LABOUR CALCULATIONS
// ============================================

/**
 * Calculate total labour hours from timesheets
 */
export function calculateTotalLabourHours(timesheets: Timesheet[]): number {
  return timesheets
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.total_hours, 0);
}

/**
 * Calculate total labour cost from timesheets
 */
export function calculateTotalLabourCost(timesheets: Timesheet[]): number {
  return timesheets
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.gross_pay, 0);
}

/**
 * Calculate labour cost percentage
 */
export function calculateLabourPercent(
  labourCost: number,
  sales: number,
): number | null {
  if (sales === 0) return null;
  return (labourCost / sales) * 100;
}

/**
 * Calculate average hourly rate
 */
export function calculateAvgHourlyRate(
  totalCost: number,
  totalHours: number,
): number {
  if (totalHours === 0) return 0;
  return totalCost / totalHours;
}

/**
 * Calculate shift cost from roster
 */
export function calculateShiftCost(shift: RosterShift, staff: Staff): number {
  const startTime = parseISO(`2000-01-01T${shift.start_time}`);
  const endTime = parseISO(`2000-01-01T${shift.end_time}`);

  const totalMinutes = differenceInMinutes(endTime, startTime);
  const workedMinutes = totalMinutes - shift.break_minutes;
  const workedHours = workedMinutes / 60;

  // Base cost
  let cost = workedHours * staff.hourly_rate;

  // Check for penalty rates (simplified)
  const shiftDate = new Date(shift.date);
  const dayOfWeek = shiftDate.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const startHour = parseInt(shift.start_time.split(":")[0]);
  const isEvening = startHour >= 18;

  if (isWeekend) {
    cost *= 1.5;
  } else if (isEvening) {
    cost *= 1.25;
  }

  return Math.round(cost);
}

/**
 * Calculate rostered hours for period
 */
export function calculateRosteredHours(shifts: RosterShift[]): number {
  return shifts.reduce((sum, shift) => {
    const startTime = parseISO(`2000-01-01T${shift.start_time}`);
    const endTime = parseISO(`2000-01-01T${shift.end_time}`);
    const totalMinutes = differenceInMinutes(endTime, startTime);
    const workedMinutes = totalMinutes - shift.break_minutes;
    return sum + workedMinutes / 60;
  }, 0);
}

/**
 * Calculate overtime hours
 */
export function calculateOvertimeHours(
  timesheets: Timesheet[],
  staff: Staff,
): number {
  let overtimeHours = 0;

  timesheets.forEach((ts) => {
    if (staff.employment_type === "full-time") {
      if (ts.total_hours > 7.6) {
        overtimeHours += ts.total_hours - 7.6;
      }
    } else if (staff.employment_type === "casual") {
      if (ts.total_hours > 10) {
        overtimeHours += ts.total_hours - 10;
      }
    }
  });

  return overtimeHours;
}

/**
 * Calculate sales per labour hour
 */
export function calculateSalesPerLabourHour(
  sales: number,
  hours: number,
): number {
  if (hours === 0) return 0;
  return sales / hours;
}

/**
 * Calculate sales per labour dollar
 */
export function calculateSalesPerLabourDollar(
  sales: number,
  labourCost: number,
): number {
  if (labourCost === 0) return 0;
  return sales / labourCost;
}

// ============================================
// ROLE ANALYSIS
// ============================================

export function calculateRoleBreakdown(
  timesheets: Timesheet[],
  staff: Staff[],
): RoleLabourBreakdown[] {
  const staffMap = new Map(staff.map((s) => [s.id, s]));

  const roleMap = new Map<
    string,
    {
      staffIds: Set<string>;
      hours: number;
      cost: number;
      overtimeHours: number;
    }
  >();

  timesheets
    .filter((t) => t.status === "approved")
    .forEach((ts) => {
      const staffMember = staffMap.get(ts.staff_id);
      if (!staffMember) return;

      const role = staffMember.role;

      if (!roleMap.has(role)) {
        roleMap.set(role, {
          staffIds: new Set(),
          hours: 0,
          cost: 0,
          overtimeHours: 0,
        });
      }

      const roleData = roleMap.get(role)!;
      roleData.staffIds.add(ts.staff_id);
      roleData.hours += ts.total_hours;
      roleData.cost += ts.gross_pay;

      if (ts.total_hours > 8) {
        roleData.overtimeHours += ts.total_hours - 8;
      }
    });

  const totalCost = Array.from(roleMap.values()).reduce(
    (sum, r) => sum + r.cost,
    0,
  );

  const breakdown = Array.from(roleMap.entries()).map(([role, data]) => ({
    role,
    staff_count: data.staffIds.size,
    total_hours: data.hours,
    total_cost: data.cost,
    share_of_total_cost: totalCost !== 0 ? (data.cost / totalCost) * 100 : 0,
    avg_hourly_rate: data.hours !== 0 ? data.cost / data.hours : 0,
    overtime_hours: data.overtimeHours,
    overtime_percent:
      data.hours !== 0 ? (data.overtimeHours / data.hours) * 100 : 0,
  }));

  return breakdown.sort((a, b) => b.total_cost - a.total_cost);
}

// ============================================
// OVERTIME ANALYSIS
// ============================================

export function calculateOvertimeAnalysis(
  timesheets: Timesheet[],
  staff: Staff[],
): OvertimeAnalysis {
  const staffMap = new Map(staff.map((s) => [s.id, s]));

  const overtimeMap = new Map<
    string,
    {
      hours: number;
      cost: number;
      weeks: Set<string>;
    }
  >();

  timesheets
    .filter((t) => t.status === "approved")
    .forEach((ts) => {
      const staffMember = staffMap.get(ts.staff_id);
      if (!staffMember) return;

      const overtimeHours = Math.max(0, ts.total_hours - 8);

      if (overtimeHours > 0) {
        if (!overtimeMap.has(ts.staff_id)) {
          overtimeMap.set(ts.staff_id, {
            hours: 0,
            cost: 0,
            weeks: new Set(),
          });
        }

        const data = overtimeMap.get(ts.staff_id)!;
        data.hours += overtimeHours;
        data.cost += overtimeHours * staffMember.hourly_rate * 1.5;

        const weekKey = format(new Date(ts.date), "yyyy-ww");
        data.weeks.add(weekKey);
      }
    });

  const totalOvertimeHours = Array.from(overtimeMap.values()).reduce(
    (sum, d) => sum + d.hours,
    0,
  );
  const totalOvertimeCost = Array.from(overtimeMap.values()).reduce(
    (sum, d) => sum + d.cost,
    0,
  );

  const totalLabourCost = calculateTotalLabourCost(timesheets);

  const staffWithOvertime = Array.from(overtimeMap.entries())
    .map(([staffId, data]) => {
      const staffMember = staffMap.get(staffId)!;
      return {
        staff_id: staffId,
        staff_name: staffMember.name,
        overtime_hours: data.hours,
        overtime_cost: data.cost,
        weeks_with_overtime: data.weeks.size,
        reason: "Coverage",
      };
    })
    .sort((a, b) => b.overtime_hours - a.overtime_hours);

  return {
    total_overtime_hours: totalOvertimeHours,
    total_overtime_cost: totalOvertimeCost,
    overtime_as_percent_of_total:
      totalLabourCost !== 0 ? (totalOvertimeCost / totalLabourCost) * 100 : 0,
    staff_with_overtime: staffWithOvertime,
    trend: "stable",
  };
}

// ============================================
// COMPLIANCE CHECKING
// ============================================

export function checkRosterCompliance(
  shifts: RosterShift[],
  timesheets: Timesheet[],
  staff: Staff[],
): RosterCompliance {
  const staffMap = new Map(staff.map((s) => [s.id, s]));
  const issues: RosterCompliance["issues"] = [];

  timesheets.forEach((ts) => {
    const staffMember = staffMap.get(ts.staff_id);
    if (!staffMember) return;

    if (ts.total_hours > 12) {
      issues.push({
        issue_type: "excessive_hours",
        severity: "high",
        staff_id: ts.staff_id,
        staff_name: staffMember.name,
        shift_date: new Date(ts.date),
        description: `${ts.total_hours} hours worked (exceeds 12 hour maximum)`,
        fair_work_reference: "FW Act s.62 - Maximum weekly hours",
        suggested_action:
          "Review shift scheduling and approve overtime if necessary",
      });
    }

    if (ts.total_hours >= 5 && ts.break_minutes < 30) {
      issues.push({
        issue_type: "insufficient_break",
        severity: "high",
        staff_id: ts.staff_id,
        staff_name: staffMember.name,
        shift_date: new Date(ts.date),
        description: `Only ${ts.break_minutes} minute break for ${ts.total_hours} hour shift`,
        fair_work_reference: "Award clause - Meal breaks",
        suggested_action:
          "Ensure 30 minute unpaid break for shifts over 5 hours",
      });
    }
  });

  const weeklyHours = new Map<string, number>();
  timesheets.forEach((ts) => {
    const current = weeklyHours.get(ts.staff_id) || 0;
    weeklyHours.set(ts.staff_id, current + ts.total_hours);
  });

  weeklyHours.forEach((hours, staffId) => {
    const staffMember = staffMap.get(staffId);
    if (!staffMember) return;

    if (staffMember.employment_type === "full-time" && hours > 38) {
      issues.push({
        issue_type: "excessive_hours",
        severity: "medium",
        staff_id: staffId,
        staff_name: staffMember.name,
        shift_date: new Date(),
        description: `${hours} hours this week (exceeds 38 hour ordinary maximum)`,
        fair_work_reference: "FW Act s.62 - Ordinary hours of work",
        suggested_action: "Pay overtime rates or reduce hours next week",
      });
    }
  });

  return {
    total_shifts: shifts.length,
    published_shifts: shifts.length,
    unpublished_shifts: 0,
    shifts_with_issues: issues.length,
    issues: issues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
  };
}

// ============================================
// EFFICIENCY METRICS
// ============================================

export function calculateLabourEfficiency(
  timesheets: Timesheet[],
  orders: Order[],
): LabourEfficiency {
  const totalHours = calculateTotalLabourHours(timesheets);
  const totalCost = calculateTotalLabourCost(timesheets);

  const totalSales = orders
    .filter((o) => !o.is_void)
    .reduce((sum, o) => sum + o.net_amount, 0);

  const totalTransactions = orders.filter((o) => !o.is_void).length;

  const salesPerLabourHour = calculateSalesPerLabourHour(
    totalSales,
    totalHours,
  );
  const salesPerLabourDollar = calculateSalesPerLabourDollar(
    totalSales,
    totalCost,
  );

  const benchmarkSalesPerLH = 15000;

  const variance =
    salesPerLabourHour !== 0
      ? ((salesPerLabourHour - benchmarkSalesPerLH) / benchmarkSalesPerLH) * 100
      : 0;

  let grade: "A" | "B" | "C" | "D" | "F" = "C";
  if (salesPerLabourHour >= benchmarkSalesPerLH * 1.2) grade = "A";
  else if (salesPerLabourHour >= benchmarkSalesPerLH * 1.1) grade = "B";
  else if (salesPerLabourHour >= benchmarkSalesPerLH * 0.9) grade = "C";
  else if (salesPerLabourHour >= benchmarkSalesPerLH * 0.8) grade = "D";
  else grade = "F";

  return {
    sales_per_labour_hour: salesPerLabourHour,
    sales_per_labour_dollar: salesPerLabourDollar,
    transactions_per_labour_hour:
      totalHours !== 0 ? totalTransactions / totalHours : 0,
    items_per_labour_hour: 0,
    staff_utilization_percent: 85,
    idle_time_hours: 0,
    peak_coverage_ratio: 1.0,
    industry_benchmark_sales_per_lh: benchmarkSalesPerLH,
    variance_vs_benchmark: variance,
    performance_grade: grade,
  };
}
