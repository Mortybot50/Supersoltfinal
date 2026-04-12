import {
  RosterShift,
  RosterWarning,
  AU_HOSPITALITY_PENALTY_RATES,
  AU_PUBLIC_HOLIDAYS_ALL,
  AU_HOLIDAY_NAMES,
  LaborBudget,
  StaffAvailability,
  HourlyStaffing,
  DayStats,
  ShiftCostBreakdown,
} from "@/types";
import { startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";

// ============================================
// PENALTY RATE ENGINE — Hospitality Industry (General) Award 2020
// ============================================

/**
 * Normalize a time value to HH:MM format.
 * Handles timestamptz strings (e.g., "2026-03-10T09:00:00+11:00") by extracting the time portion.
 */
function parseTimeToHHMM(time: string): string {
  if (!time) return "00:00";
  // Already HH:MM
  if (/^\d{2}:\d{2}$/.test(time)) return time;
  // HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) return time.slice(0, 5);
  // ISO timestamp — extract local time
  const match = time.match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  // Try Date parse as last resort
  try {
    const d = new Date(time);
    if (!isNaN(d.getTime())) {
      return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
  } catch {
    /* ignore */
  }
  return time.slice(0, 5);
}

/**
 * Full shift cost calculation with Award-compliant penalty rates.
 *
 * Returns a detailed breakdown of base cost, penalty cost, warnings.
 * This is the single source of truth for all shift costing.
 */
export function calculateShiftCostBreakdown(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  hourlyRateCents: number,
  venueId: string,
  date?: Date,
  employmentType: "full-time" | "part-time" | "casual" = "casual",
  state: string = "VIC",
  weeklyHoursSoFar: number = 0,
): ShiftCostBreakdown {
  const warnings: string[] = [];

  // Parse times — normalize timestamptz to HH:MM
  startTime = parseTimeToHHMM(startTime);
  endTime = parseTimeToHHMM(endTime);
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let totalMinutes = endH * 60 + endM - (startH * 60 + startM);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // overnight

  // Break deduction
  const workMinutes = Math.max(0, totalMinutes - breakMinutes);
  const baseHours = workMinutes / 60;
  const roundedHours = Math.round(baseHours * 100) / 100;

  // Minimum engagement check
  const isCasual = employmentType === "casual";
  const isPartTime = employmentType === "part-time";
  const minHours = isCasual
    ? AU_HOSPITALITY_PENALTY_RATES.minimum_shift_hours_casual
    : isPartTime
      ? AU_HOSPITALITY_PENALTY_RATES.minimum_shift_hours_part_time
      : 0;

  if (minHours > 0 && roundedHours < minHours) {
    warnings.push(
      `Shift is ${roundedHours.toFixed(1)}h — below ${minHours}h minimum engagement for ${employmentType}`,
    );
  }

  // Break rule checks
  if (
    roundedHours > AU_HOSPITALITY_PENALTY_RATES.meal_break_threshold_hours &&
    breakMinutes < AU_HOSPITALITY_PENALTY_RATES.meal_break_duration_minutes
  ) {
    warnings.push(
      `Shift >5h requires 30-min unpaid meal break (only ${breakMinutes}min scheduled)`,
    );
  }
  if (
    roundedHours > AU_HOSPITALITY_PENALTY_RATES.rest_break_threshold_hours &&
    breakMinutes < AU_HOSPITALITY_PENALTY_RATES.rest_break_duration_minutes
  ) {
    warnings.push(`Shift >4h requires 10-min paid rest break`);
  }

  // Determine penalty
  const { penaltyType, penaltyMultiplier } = calculatePenaltyRate(
    date,
    startTime,
    endTime,
    state,
    isCasual,
  );

  // Overtime check (full-time only: >38h/week or >10h/day)
  let overtimeHours = 0;
  let overtimeMultiplier = 1;
  if (employmentType === "full-time") {
    // Daily overtime: >10h
    if (roundedHours > 10) {
      overtimeHours = roundedHours - 10;
      warnings.push(
        `${overtimeHours.toFixed(1)}h overtime (shift exceeds 10h/day)`,
      );
    }
    // Weekly overtime: >38h
    if (weeklyHoursSoFar + roundedHours > 38) {
      const weeklyOT = Math.max(0, weeklyHoursSoFar + roundedHours - 38);
      if (weeklyOT > overtimeHours) {
        overtimeHours = weeklyOT;
        warnings.push(`${weeklyOT.toFixed(1)}h overtime (exceeds 38h/week)`);
      }
    }
    if (overtimeHours > 0) {
      // First 2 hours at 1.5×, after at 2.0×
      if (overtimeHours <= 2) {
        overtimeMultiplier =
          AU_HOSPITALITY_PENALTY_RATES.overtime_first_2_hours;
      } else {
        overtimeMultiplier =
          AU_HOSPITALITY_PENALTY_RATES.overtime_after_2_hours;
      }
    }
  }

  // Calculate costs
  const ordinaryHours = Math.max(0, roundedHours - overtimeHours);
  const baseCostCents = Math.round(ordinaryHours * hourlyRateCents);
  const penaltyCostCents = Math.round(
    ordinaryHours * hourlyRateCents * (penaltyMultiplier - 1),
  );
  const overtimeCostCents =
    overtimeHours > 0
      ? Math.round(overtimeHours * hourlyRateCents * overtimeMultiplier) -
        Math.round(overtimeHours * hourlyRateCents)
      : 0;

  const totalPenaltyCents = penaltyCostCents + overtimeCostCents;
  const totalCostCents =
    Math.round(roundedHours * hourlyRateCents * penaltyMultiplier) +
    (overtimeHours > 0
      ? Math.round(
          overtimeHours *
            hourlyRateCents *
            (overtimeMultiplier - penaltyMultiplier),
        )
      : 0);

  return {
    base_hours: roundedHours,
    base_cost_cents: baseCostCents,
    penalty_type: penaltyType === "none" ? null : penaltyType,
    penalty_multiplier: penaltyMultiplier,
    penalty_cost_cents: totalPenaltyCents,
    break_deduction_minutes: breakMinutes,
    total_cost_cents: Math.max(totalCostCents, baseCostCents),
    warnings,
  };
}

/**
 * Calculate the total hours and cost for a shift (with penalty rates).
 * Backward-compatible wrapper around calculateShiftCostBreakdown.
 */
export function calculateShiftHoursAndCost(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  hourlyRateCents: number,
  venueId: string,
  date?: Date,
  isCasual: boolean = false,
  state: string = "VIC",
): {
  hours: number;
  baseCost: number;
  penaltyCost: number;
  cost: number;
  penaltyType: string;
  penaltyMultiplier: number;
  warnings: string[];
} {
  const breakdown = calculateShiftCostBreakdown(
    startTime,
    endTime,
    breakMinutes,
    hourlyRateCents,
    venueId,
    date,
    isCasual ? "casual" : "full-time",
    state,
  );

  return {
    hours: breakdown.base_hours,
    baseCost: breakdown.base_cost_cents,
    penaltyCost: breakdown.penalty_cost_cents,
    cost: breakdown.total_cost_cents,
    penaltyType: breakdown.penalty_type || "none",
    penaltyMultiplier: breakdown.penalty_multiplier,
    warnings: breakdown.warnings,
  };
}

/**
 * Calculate penalty rate based on day, time, and employment type.
 *
 * Priority: Public Holiday > Sunday > Saturday > Evening (>7pm weekdays) > Early morning (<7am) > None
 *
 * For casuals:
 * - Saturday: no extra penalty (25% loading covers it)
 * - Sunday: 1.75× (separate award rate)
 * - Public Holiday: 2.75× (separate award rate)
 */
export function calculatePenaltyRate(
  date?: Date,
  startTime?: string,
  endTime?: string,
  state: string = "VIC",
  isCasual: boolean = false,
): { penaltyType: string; penaltyMultiplier: number } {
  if (!date) {
    return { penaltyType: "none", penaltyMultiplier: 1 };
  }

  // Coerce string/null to Date (DB often returns ISO strings)
  const safeDate = date instanceof Date ? date : new Date(date);
  if (isNaN(safeDate.getTime())) {
    return { penaltyType: "none", penaltyMultiplier: 1 };
  }

  // Use local date components (not UTC) — holidays are defined in YYYY-MM-DD local time.
  // toISOString() shifts to UTC and can return the wrong calendar date in AEST/AEDT.
  const y = safeDate.getFullYear();
  const m = String(safeDate.getMonth() + 1).padStart(2, "0");
  const d = String(safeDate.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  const dayOfWeek = safeDate.getDay();

  // Check public holidays first (highest rate)
  const allHolidays = [
    ...(AU_PUBLIC_HOLIDAYS_ALL.national || []),
    ...(AU_PUBLIC_HOLIDAYS_ALL[state] || []),
  ];
  if (allHolidays.includes(dateStr)) {
    return {
      penaltyType: "public_holiday",
      penaltyMultiplier: isCasual
        ? AU_HOSPITALITY_PENALTY_RATES.casual_public_holiday
        : AU_HOSPITALITY_PENALTY_RATES.public_holiday,
    };
  }

  // Sunday
  if (dayOfWeek === 0) {
    return {
      penaltyType: "sunday",
      penaltyMultiplier: isCasual
        ? AU_HOSPITALITY_PENALTY_RATES.casual_sunday
        : AU_HOSPITALITY_PENALTY_RATES.sunday,
    };
  }

  // Saturday
  if (dayOfWeek === 6) {
    return {
      penaltyType: "saturday",
      penaltyMultiplier: isCasual
        ? AU_HOSPITALITY_PENALTY_RATES.casual_saturday
        : AU_HOSPITALITY_PENALTY_RATES.saturday,
    };
  }

  // Weekday time-based penalties
  if (startTime && endTime) {
    const [endH] = endTime.split(":").map(Number);
    const [startH] = startTime.split(":").map(Number);

    // Evening: shift spans past 7pm on weekdays
    if (endH >= 19 || (endH < startH && endH > 0)) {
      return {
        penaltyType: "evening",
        penaltyMultiplier: AU_HOSPITALITY_PENALTY_RATES.evening,
      };
    }

    // Early morning: starts before 7am
    if (startH < 7) {
      return {
        penaltyType: "early_morning",
        penaltyMultiplier: AU_HOSPITALITY_PENALTY_RATES.early_morning,
      };
    }
  }

  return { penaltyType: "none", penaltyMultiplier: 1 };
}

// ============================================
// WEEKLY METRICS
// ============================================

/**
 * Calculate weekly roster metrics
 */
export function calculateWeeklyRosterMetrics(shifts: RosterShift[]): {
  totalHours: number;
  totalCost: number;
  baseCost: number;
  penaltyCost: number;
  shiftCount: number;
  staffCount: number;
  avgHourlyRate: number;
} {
  const activeShifts = shifts.filter((s) => s.status !== "cancelled");
  const uniqueStaff = new Set(activeShifts.map((s) => s.staff_id));

  const result = activeShifts.reduce(
    (acc, shift) => ({
      totalHours: acc.totalHours + shift.total_hours,
      totalCost: acc.totalCost + shift.total_cost,
      baseCost: acc.baseCost + (shift.base_cost || shift.total_cost),
      penaltyCost: acc.penaltyCost + (shift.penalty_cost || 0),
      shiftCount: acc.shiftCount + 1,
      staffCount: uniqueStaff.size,
    }),
    {
      totalHours: 0,
      totalCost: 0,
      baseCost: 0,
      penaltyCost: 0,
      shiftCount: 0,
      staffCount: 0,
    },
  );

  return {
    ...result,
    avgHourlyRate:
      result.totalHours > 0
        ? Math.round(result.totalCost / result.totalHours)
        : 0,
  };
}

/**
 * Calculate labor budget variance
 */
export function calculateBudgetVariance(
  budget: LaborBudget | null,
  actualCost: number,
): {
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: "under" | "warning" | "over" | "critical";
} {
  if (!budget) {
    return {
      budgeted: 0,
      actual: actualCost,
      variance: 0,
      variancePercent: 0,
      status: "under",
    };
  }

  const variance = actualCost - budget.budgeted_amount;
  const variancePercent =
    budget.budgeted_amount > 0
      ? (actualCost / budget.budgeted_amount) * 100
      : 0;

  let status: "under" | "warning" | "over" | "critical" = "under";
  if (variancePercent >= budget.critical_threshold_percent) {
    status = "critical";
  } else if (variancePercent >= budget.warning_threshold_percent) {
    status = "warning";
  } else if (variance > 0) {
    status = "over";
  }

  return {
    budgeted: budget.budgeted_amount,
    actual: actualCost,
    variance,
    variancePercent: Math.round(variancePercent),
    status,
  };
}

// ============================================
// COMPLIANCE WARNINGS
// ============================================

/**
 * Check if a new/updated shift conflicts with existing shifts
 */
export function hasShiftConflict(
  shifts: RosterShift[],
  staffId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeShiftId?: string,
): boolean {
  const dateStr = date.toISOString().split("T")[0];

  return shifts.some((s) => {
    if (s.status === "cancelled") return false;
    if (excludeShiftId && s.id === excludeShiftId) return false;
    if (s.staff_id !== staffId) return false;
    const shiftDateStr = new Date(s.date).toISOString().split("T")[0];
    if (shiftDateStr !== dateStr) return false;

    const [newStartH, newStartM] = startTime.split(":").map(Number);
    const [newEndH, newEndM] = endTime.split(":").map(Number);
    const [existStartH, existStartM] = s.start_time.split(":").map(Number);
    const [existEndH, existEndM] = s.end_time.split(":").map(Number);

    const newStart = newStartH * 60 + newStartM;
    const newEnd = newEndH * 60 + newEndM;
    const existStart = existStartH * 60 + existStartM;
    const existEnd = existEndH * 60 + existEndM;

    return !(newEnd <= existStart || newStart >= existEnd);
  });
}

/**
 * Detect rest gap violations (<10h between shifts)
 */
export function detectRestGapWarnings(shifts: RosterShift[]): RosterWarning[] {
  const warnings: RosterWarning[] = [];
  const activeShifts = shifts.filter((s) => s.status !== "cancelled");

  const byStaff: Record<string, RosterShift[]> = {};
  activeShifts.forEach((s) => {
    if (!byStaff[s.staff_id]) byStaff[s.staff_id] = [];
    byStaff[s.staff_id].push(s);
  });

  for (const [staffId, staffShifts] of Object.entries(byStaff)) {
    const sorted = staffShifts.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime())
        return dateA.getTime() - dateB.getTime();
      return a.start_time.localeCompare(b.start_time);
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      const currentDate = new Date(current.date);
      const [endH, endM] = current.end_time.split(":").map(Number);
      currentDate.setHours(endH, endM, 0, 0);

      const [startH] = current.start_time.split(":").map(Number);
      if (endH < startH) currentDate.setDate(currentDate.getDate() + 1);

      const nextDate = new Date(next.date);
      const [nextStartH, nextStartM] = next.start_time.split(":").map(Number);
      nextDate.setHours(nextStartH, nextStartM, 0, 0);

      const gapMs = nextDate.getTime() - currentDate.getTime();
      const gapHours = gapMs / (1000 * 60 * 60);

      if (gapHours >= 0 && gapHours < 10) {
        warnings.push({
          id: `rest-${current.id}-${next.id}`,
          shift_id: next.id,
          staff_id: staffId,
          staff_name: current.staff_name,
          type: "rest_gap",
          severity: gapHours < 8 ? "error" : "warning",
          message: `Only ${gapHours.toFixed(1)}h rest before next shift (minimum 10h required)`,
          details: {
            gap_hours: gapHours,
            shift_date: new Date(next.date).toISOString().split("T")[0],
          },
          acknowledged: false,
        });
      }
    }
  }

  return warnings;
}

/**
 * Detect break requirement violations
 */
export function detectBreakWarnings(shifts: RosterShift[]): RosterWarning[] {
  const warnings: RosterWarning[] = [];
  const activeShifts = shifts.filter((s) => s.status !== "cancelled");

  activeShifts.forEach((shift) => {
    if (shift.total_hours > 5 && shift.break_minutes < 30) {
      warnings.push({
        id: `break-${shift.id}`,
        shift_id: shift.id,
        staff_id: shift.staff_id,
        staff_name: shift.staff_name,
        type: "break_required",
        severity: "warning",
        message: `${shift.total_hours.toFixed(1)}h shift requires 30min meal break (only ${shift.break_minutes}min scheduled)`,
        details: { hours: shift.total_hours, limit: 5 },
        acknowledged: false,
      });
    }

    if (shift.total_hours > 10 && shift.break_minutes < 60) {
      warnings.push({
        id: `break-long-${shift.id}`,
        shift_id: shift.id,
        staff_id: shift.staff_id,
        staff_name: shift.staff_name,
        type: "break_required",
        severity: "error",
        message: `${shift.total_hours.toFixed(1)}h shift requires 60min total breaks (only ${shift.break_minutes}min scheduled)`,
        details: { hours: shift.total_hours, limit: 10 },
        acknowledged: false,
      });
    }
  });

  return warnings;
}

/**
 * Detect minimum engagement violations (casual/part-time <3h)
 */
export function detectMinimumEngagementWarnings(
  shifts: RosterShift[],
  staffEmploymentTypes: Record<string, string>,
): RosterWarning[] {
  const warnings: RosterWarning[] = [];
  const activeShifts = shifts.filter((s) => s.status !== "cancelled");

  activeShifts.forEach((shift) => {
    const empType = staffEmploymentTypes[shift.staff_id] || "casual";
    if (
      (empType === "casual" || empType === "part-time") &&
      shift.total_hours < 3
    ) {
      warnings.push({
        id: `min-engage-${shift.id}`,
        shift_id: shift.id,
        staff_id: shift.staff_id,
        staff_name: shift.staff_name,
        type: "minor_hours",
        severity: "warning",
        message: `${shift.total_hours.toFixed(1)}h shift — below 3h minimum engagement for ${empType} employees`,
        details: { hours: shift.total_hours, limit: 3 },
        acknowledged: false,
      });
    }
  });

  return warnings;
}

/**
 * Detect overtime warnings for staff (>38h/week or >10h/day)
 */
export function detectOvertimeWarnings(
  shifts: RosterShift[],
): Array<{
  staffId: string;
  staffName: string;
  hours: number;
  warning: string;
  type: "weekly" | "daily";
}> {
  const warnings: Array<{
    staffId: string;
    staffName: string;
    hours: number;
    warning: string;
    type: "weekly" | "daily";
  }> = [];
  const activeShifts = shifts.filter((s) => s.status !== "cancelled");

  // Weekly hours
  const byStaff: Record<string, { name: string; hours: number }> = {};
  activeShifts.forEach((s) => {
    if (!byStaff[s.staff_id])
      byStaff[s.staff_id] = { name: s.staff_name, hours: 0 };
    byStaff[s.staff_id].hours += s.total_hours;
  });

  for (const [staffId, data] of Object.entries(byStaff)) {
    if (data.hours > 38) {
      warnings.push({
        staffId,
        staffName: data.name,
        hours: data.hours,
        warning: `${data.hours.toFixed(1)}h rostered (exceeds 38h/week)`,
        type: "weekly",
      });
    }
  }

  // Daily hours (>10h)
  const byStaffDay: Record<
    string,
    { name: string; hours: number; date: string }
  > = {};
  activeShifts.forEach((s) => {
    const dateStr = new Date(s.date).toISOString().split("T")[0];
    const key = `${s.staff_id}_${dateStr}`;
    if (!byStaffDay[key])
      byStaffDay[key] = { name: s.staff_name, hours: 0, date: dateStr };
    byStaffDay[key].hours += s.total_hours;
  });

  for (const [key, data] of Object.entries(byStaffDay)) {
    if (data.hours > 10) {
      warnings.push({
        staffId: key.split("_")[0],
        staffName: data.name,
        hours: data.hours,
        warning: `${data.hours.toFixed(1)}h on ${data.date} (exceeds 10h/day)`,
        type: "daily",
      });
    }
  }

  return warnings;
}

/**
 * Check availability conflicts
 */
export function detectAvailabilityConflicts(
  shifts: RosterShift[],
  availability: StaffAvailability[],
): RosterWarning[] {
  const warnings: RosterWarning[] = [];
  const activeShifts = shifts.filter((s) => s.status !== "cancelled");

  activeShifts.forEach((shift) => {
    const shiftDate = new Date(shift.date);
    const dayOfWeek = shiftDate.getDay();
    const dateStr = shiftDate.toISOString().split("T")[0];

    const staffUnavailable = availability.filter(
      (a) => a.staff_id === shift.staff_id && a.type === "unavailable",
    );

    staffUnavailable.forEach((unavail) => {
      let isConflict = false;
      if (unavail.is_recurring && unavail.day_of_week === dayOfWeek) {
        isConflict = true;
      } else if (unavail.specific_date) {
        const unavailDate = new Date(unavail.specific_date)
          .toISOString()
          .split("T")[0];
        if (unavailDate === dateStr) isConflict = true;
      }

      if (isConflict) {
        warnings.push({
          id: `avail-${shift.id}-${unavail.id}`,
          shift_id: shift.id,
          staff_id: shift.staff_id,
          staff_name: shift.staff_name,
          type: "availability_conflict",
          severity: "warning",
          message: `Scheduled during marked unavailability${unavail.notes ? `: ${unavail.notes}` : ""}`,
          details: { shift_date: dateStr },
          acknowledged: false,
        });
      }
    });
  });

  return warnings;
}

/**
 * Get all roster warnings combined
 */
export function getAllRosterWarnings(
  shifts: RosterShift[],
  availability: StaffAvailability[] = [],
  budget: LaborBudget | null = null,
  staffEmploymentTypes: Record<string, string> = {},
): RosterWarning[] {
  const warnings: RosterWarning[] = [];

  warnings.push(...detectRestGapWarnings(shifts));
  warnings.push(...detectBreakWarnings(shifts));
  warnings.push(...detectAvailabilityConflicts(shifts, availability));
  warnings.push(
    ...detectMinimumEngagementWarnings(shifts, staffEmploymentTypes),
  );

  const overtimeWarnings = detectOvertimeWarnings(shifts);
  overtimeWarnings.forEach((ow) => {
    warnings.push({
      id: `overtime-${ow.staffId}-${ow.type}`,
      staff_id: ow.staffId,
      staff_name: ow.staffName,
      type: ow.type === "weekly" ? "overtime_weekly" : "overtime_daily",
      severity: ow.hours > 45 ? "error" : "warning",
      message: ow.warning,
      details: { hours: ow.hours, limit: ow.type === "weekly" ? 38 : 10 },
      acknowledged: false,
    });
  });

  if (budget) {
    const metrics = calculateWeeklyRosterMetrics(shifts);
    const budgetStatus = calculateBudgetVariance(budget, metrics.totalCost);

    if (budgetStatus.status === "over" || budgetStatus.status === "critical") {
      warnings.push({
        id: `budget-${budget.id}`,
        staff_id: "",
        staff_name: "All Staff",
        type: "budget_exceeded",
        severity: budgetStatus.status === "critical" ? "error" : "warning",
        message: `Labor cost ${budgetStatus.variancePercent}% of budget ($${(budgetStatus.actual / 100).toFixed(2)} of $${(budgetStatus.budgeted / 100).toFixed(2)})`,
        acknowledged: false,
      });
    }
  }

  return warnings;
}

// ============================================
// DATE & TIME UTILITIES
// ============================================

export function getShiftsForWeek(
  shifts: RosterShift[],
  weekStart: Date,
): RosterShift[] {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStartNorm = new Date(weekStart);
  weekStartNorm.setHours(0, 0, 0, 0);

  return shifts.filter((s) => {
    const shiftDate = new Date(s.date);
    shiftDate.setHours(12, 0, 0, 0);
    return shiftDate >= weekStartNorm && shiftDate <= weekEnd;
  });
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function isPublicHoliday(date: Date, state: string = "VIC"): boolean {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dateStr = `${y}-${m}-${String(date.getDate()).padStart(2, "0")}`;
  const allHolidays = [
    ...(AU_PUBLIC_HOLIDAYS_ALL.national || []),
    ...(AU_PUBLIC_HOLIDAYS_ALL[state] || []),
  ];
  return allHolidays.includes(dateStr);
}

export function getPublicHolidayName(
  date: Date,
  _state: string = "VIC",
): string | null {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dateStr = `${y}-${m}-${String(date.getDate()).padStart(2, "0")}`;
  return AU_HOLIDAY_NAMES[dateStr] || null;
}

// ============================================
// ROLE COLOR UTILITIES
// ============================================

const ROLE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; light: string }
> = {
  kitchen: {
    bg: "bg-blue-500",
    text: "text-blue-700",
    border: "border-blue-300",
    light: "bg-blue-50 dark:bg-blue-950/30",
  },
  foh: {
    bg: "bg-green-500",
    text: "text-green-700",
    border: "border-green-300",
    light: "bg-green-50 dark:bg-green-950/30",
  },
  bar: {
    bg: "bg-purple-500",
    text: "text-purple-700",
    border: "border-purple-300",
    light: "bg-purple-50 dark:bg-purple-950/30",
  },
  manager: {
    bg: "bg-gray-500",
    text: "text-gray-700",
    border: "border-gray-300",
    light: "bg-gray-50 dark:bg-gray-800/30",
  },
  management: {
    bg: "bg-gray-500",
    text: "text-gray-700",
    border: "border-gray-300",
    light: "bg-gray-50 dark:bg-gray-800/30",
  },
  supervisor: {
    bg: "bg-teal-500",
    text: "text-teal-700",
    border: "border-teal-300",
    light: "bg-teal-50 dark:bg-teal-950/30",
  },
  crew: {
    bg: "bg-amber-500",
    text: "text-amber-700",
    border: "border-amber-300",
    light: "bg-amber-50 dark:bg-amber-950/30",
  },
};

const DEFAULT_ROLE_COLOR = {
  bg: "bg-slate-500",
  text: "text-slate-700",
  border: "border-slate-300",
  light: "bg-slate-50 dark:bg-slate-800/30",
};

export function getRoleColor(role: string): {
  bg: string;
  text: string;
  border: string;
  light: string;
} {
  return ROLE_COLORS[role.toLowerCase()] || DEFAULT_ROLE_COLOR;
}

// ============================================
// FORMATTING UTILITIES
// ============================================

export function formatLabourCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function formatPenaltyRate(multiplier: number): string {
  if (multiplier === 1) return "Base rate";
  return `${Math.round(multiplier * 100)}%`;
}

export function getPenaltyBadgeColor(penaltyType: string): string {
  switch (penaltyType) {
    case "public_holiday":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "sunday":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "saturday":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "late_night":
    case "early_morning":
    case "evening":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "overtime":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function formatTimeCompact(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "p" : "a";
  const hour12 = hours % 12 || 12;
  return minutes === 0
    ? `${hour12}:00${suffix}`
    : `${hour12}:${minutes.toString().padStart(2, "0")}${suffix}`;
}

// ============================================
// EXTENDED DATE UTILITIES
// ============================================

export function getFortnightDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function getMonthDates(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  return eachDayOfInterval({ start: monthStart, end: monthEnd });
}

export function getShiftsForDateRange(
  shifts: RosterShift[],
  rangeStart: Date,
  rangeEnd: Date,
): RosterShift[] {
  const startNorm = new Date(rangeStart);
  startNorm.setHours(0, 0, 0, 0);
  const endNorm = new Date(rangeEnd);
  endNorm.setHours(23, 59, 59, 999);

  return shifts.filter((s) => {
    const shiftDate = new Date(s.date);
    shiftDate.setHours(12, 0, 0, 0);
    return shiftDate >= startNorm && shiftDate <= endNorm;
  });
}

export function getShiftsForDay(
  shifts: RosterShift[],
  date: Date,
): RosterShift[] {
  const dateStr = date.toISOString().split("T")[0];
  return shifts.filter((s) => {
    const shiftDate = new Date(s.date).toISOString().split("T")[0];
    return shiftDate === dateStr && s.status !== "cancelled";
  });
}

// ============================================
// HOURLY STAFFING & DAY STATS
// ============================================

export function calculateHourlyStaffing(
  shifts: RosterShift[],
  date: Date,
): HourlyStaffing[] {
  const dayShifts = getShiftsForDay(shifts, date).filter(
    (s) => !s.is_open_shift,
  );
  const slots: HourlyStaffing[] = [];

  for (let hour = 6; hour <= 23; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 23 && minute === 30) break;

      const slotMinutes = hour * 60 + minute;
      let staffCount = 0;
      dayShifts.forEach((shift) => {
        const [startH, startM] = shift.start_time.split(":").map(Number);
        const [endH, endM] = shift.end_time.split(":").map(Number);
        const shiftStart = startH * 60 + startM;
        let shiftEnd = endH * 60 + endM;
        if (shiftEnd <= shiftStart) shiftEnd += 24 * 60;

        if (slotMinutes >= shiftStart && slotMinutes < shiftEnd) staffCount++;
      });

      // Mock demand curve
      const t = hour + minute / 60;
      const lunchPeak = Math.exp(-0.5 * ((t - 13) / 1.2) ** 2) * 8;
      const dinnerPeak = Math.exp(-0.5 * ((t - 19) / 1.5) ** 2) * 10;
      const baseDemand = 2;
      const predictedDemand =
        Math.round((baseDemand + lunchPeak + dinnerPeak) * 10) / 10;

      const ampm = hour >= 12 ? "pm" : "am";
      const hour12 = hour % 12 || 12;
      const label = minute === 0 ? `${hour12}${ampm}` : `${hour12}:30${ampm}`;

      slots.push({ hour, minute, label, staffCount, predictedDemand });
    }
  }

  return slots;
}

export function calculateDayStats(
  shifts: RosterShift[],
  date: Date,
  salesForecast?: number,
): DayStats {
  const dayShifts = getShiftsForDay(shifts, date).filter(
    (s) => !s.is_open_shift,
  );
  const uniqueStaff = new Set(dayShifts.map((s) => s.staff_id));

  const totalHours = dayShifts.reduce((sum, s) => sum + s.total_hours, 0);
  const totalCost = dayShifts.reduce((sum, s) => sum + s.total_cost, 0);
  const forecast = salesForecast ?? 500000;

  return {
    date,
    totalHours,
    totalCost,
    shiftCount: dayShifts.length,
    staffCount: uniqueStaff.size,
    avgHourlyRate: totalHours > 0 ? Math.round(totalCost / totalHours) : 0,
    salesForecast: forecast,
    sph: totalHours > 0 ? Math.round(forecast / totalHours) : 0,
    wagePercentRevenue:
      forecast > 0 ? Math.round((totalCost / forecast) * 10000) / 100 : 0,
  };
}

// ============================================
// SHIFT TEMPLATES
// ============================================

export function applyShiftTemplate(
  template: {
    start_time: string;
    end_time: string;
    break_minutes: number;
    role: string;
  },
  staffId: string,
  staffName: string,
  date: Date,
  hourlyRateCents: number,
  venueId: string,
): Omit<RosterShift, "id"> {
  const calc = calculateShiftHoursAndCost(
    template.start_time,
    template.end_time,
    template.break_minutes,
    hourlyRateCents,
    venueId,
    date,
  );

  return {
    venue_id: venueId,
    staff_id: staffId,
    staff_name: staffName,
    date,
    start_time: template.start_time,
    end_time: template.end_time,
    break_minutes: template.break_minutes,
    role: template.role,
    status: "scheduled",
    total_hours: calc.hours,
    base_cost: calc.baseCost,
    penalty_cost: calc.penaltyCost,
    total_cost: calc.cost,
    penalty_type: calc.penaltyType as RosterShift["penalty_type"],
    penalty_multiplier: calc.penaltyMultiplier,
  };
}
