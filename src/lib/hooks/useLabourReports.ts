/**
 * Labour Reports — React Query hooks
 * All hooks query Supabase directly (not Zustand).
 * Scoped by org_id via RLS + explicit venue_id filter.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import {
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  startOfWeek,
  endOfWeek,
  isSameWeek,
  differenceInCalendarDays,
} from "date-fns";

// ============================================================
// SHARED TYPES
// ============================================================

export interface DateRange {
  from: Date;
  to: Date;
}

/** Calculate hours from shift time strings (HH:MM or HH:MM:SS) */
function calcHours(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  breakMins: number,
): number {
  if (!startTime || !endTime) return 0;
  const toMins = (t: string) => {
    // Handle both "HH:MM" and full timestamptz "2026-03-12T09:00:00+11:00" formats
    if (t.includes("T")) {
      const d = new Date(t);
      return d.getHours() * 60 + d.getMinutes();
    }
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let mins = toMins(endTime) - toMins(startTime) - breakMins;
  if (mins < 0) mins += 24 * 60;
  return Math.max(0, mins / 60);
}

// ============================================================
// HOOK 1: LABOUR HOURS & COST
// ============================================================

export interface LabourCostDay {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Mon 3"
  baseCost: number; // cents
  penaltyCost: number; // cents
  totalCost: number; // cents
  totalHours: number;
}

export interface LabourCostData {
  days: LabourCostDay[];
  totalHours: number;
  totalCost: number; // cents
  baseCost: number; // cents
  penaltyCost: number; // cents
  avgHourlyRate: number; // dollars
  shiftCount: number;
}

export function useLabourCostReport(
  venueId: string | undefined,
  dateRange: DateRange,
) {
  const from = format(dateRange.from, "yyyy-MM-dd");
  const to = format(dateRange.to, "yyyy-MM-dd");

  const {
    data: raw,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["labourShifts", venueId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_shifts")
        .select(
          "shift_date, start_time, end_time, break_duration_mins, base_cost, penalty_cost, estimated_cost, penalty_type, status",
        )
        .eq("venue_id", venueId!)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const data = useMemo((): LabourCostData => {
    if (!raw || raw.length === 0) {
      return {
        days: [],
        totalHours: 0,
        totalCost: 0,
        baseCost: 0,
        penaltyCost: 0,
        avgHourlyRate: 0,
        shiftCount: 0,
      };
    }

    const days = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to,
    }).map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayShifts = raw.filter((s) => s.shift_date === dateStr);
      const totalHours = dayShifts.reduce(
        (sum, s) =>
          sum + calcHours(s.start_time, s.end_time, s.break_duration_mins || 0),
        0,
      );
      const baseCost = Math.round(
        dayShifts.reduce((sum, s) => sum + (s.base_cost || 0), 0) * 100,
      );
      const penaltyCost = Math.round(
        dayShifts.reduce((sum, s) => sum + (s.penalty_cost || 0), 0) * 100,
      );
      const totalCost = Math.round(
        dayShifts.reduce((sum, s) => sum + (s.estimated_cost || 0), 0) * 100,
      );
      return {
        date: dateStr,
        label: format(day, "EEE d"),
        baseCost,
        penaltyCost,
        totalCost,
        totalHours,
      };
    });

    const totalHours = raw.reduce(
      (sum, s) =>
        sum + calcHours(s.start_time, s.end_time, s.break_duration_mins || 0),
      0,
    );
    const totalCost = Math.round(
      raw.reduce((sum, s) => sum + (s.estimated_cost || 0), 0) * 100,
    );
    const baseCost = Math.round(
      raw.reduce((sum, s) => sum + (s.base_cost || 0), 0) * 100,
    );
    const penaltyCost = Math.round(
      raw.reduce((sum, s) => sum + (s.penalty_cost || 0), 0) * 100,
    );
    const avgHourlyRate = totalHours > 0 ? totalCost / totalHours / 100 : 0;

    return {
      days,
      totalHours,
      totalCost,
      baseCost,
      penaltyCost,
      avgHourlyRate,
      shiftCount: raw.length,
    };
  }, [raw, dateRange]);

  return { data, isLoading, error };
}

// ============================================================
// HOOK 2: LABOUR % (COST / REVENUE)
// ============================================================

export interface LabourPercentDay {
  date: string;
  label: string;
  revenue: number; // cents
  labourCost: number; // cents
  labourPercent: number;
}

export interface LabourPercentData {
  rows: LabourPercentDay[];
  totalRevenue: number; // cents
  totalLabourCost: number; // cents
  labourPercent: number;
  hasRevenue: boolean;
}

export function useLabourPercentReport(
  venueId: string | undefined,
  dateRange: DateRange,
) {
  const from = format(dateRange.from, "yyyy-MM-dd");
  const to = format(dateRange.to, "yyyy-MM-dd");

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["labourShifts", venueId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_shifts")
        .select(
          "shift_date, start_time, end_time, break_duration_mins, base_cost, penalty_cost, estimated_cost, penalty_type, status",
        )
        .eq("venue_id", venueId!)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders", venueId, `${from}T00:00:00`, `${to}T23:59:59`],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("order_datetime, net_amount, is_void, is_refund")
        .eq("venue_id", venueId!)
        .gte("order_datetime", `${from}T00:00:00`)
        .lte("order_datetime", `${to}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const isLoading = shiftsLoading || ordersLoading;

  const data = useMemo((): LabourPercentData => {
    const days = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to,
    }).map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");

      const dayShifts = (shifts || []).filter((s) => s.shift_date === dateStr);
      const labourCost = Math.round(
        dayShifts.reduce((sum, s) => sum + (s.estimated_cost || 0), 0) * 100,
      );

      const dayOrders = (orders || []).filter((o) =>
        o.order_datetime?.startsWith(dateStr),
      );
      const revenue = dayOrders
        .filter((o) => !o.is_void)
        .reduce(
          (sum, o) =>
            sum + (o.is_refund ? -(o.net_amount || 0) : o.net_amount || 0),
          0,
        );

      const labourPercent = revenue > 0 ? (labourCost / revenue) * 100 : 0;

      return {
        date: dateStr,
        label: format(day, "EEE d"),
        revenue,
        labourCost,
        labourPercent,
      };
    });

    const totalRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
    const totalLabourCost = days.reduce((sum, d) => sum + d.labourCost, 0);
    const labourPercent =
      totalRevenue > 0 ? (totalLabourCost / totalRevenue) * 100 : 0;

    return {
      rows: days,
      totalRevenue,
      totalLabourCost,
      labourPercent,
      hasRevenue: totalRevenue > 0,
    };
  }, [shifts, orders, dateRange]);

  return { data, isLoading, error: null };
}

// ============================================================
// HOOK 3: ROSTERED VS ACTUAL
// ============================================================

export interface RosteredVsActualRow {
  staffId: string;
  staffName: string;
  rosteredHours: number;
  actualHours: number;
  varianceHours: number;
  variancePct: number;
}

export interface RosteredVsActualData {
  rows: RosteredVsActualRow[];
  totalRostered: number;
  totalActual: number;
  hasActual: boolean;
}

export function useRosteredVsActualReport(
  venueId: string | undefined,
  dateRange: DateRange,
) {
  const from = format(dateRange.from, "yyyy-MM-dd");
  const to = format(dateRange.to, "yyyy-MM-dd");

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["labourShifts", venueId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_shifts")
        .select(
          "shift_date, start_time, end_time, break_duration_mins, base_cost, penalty_cost, estimated_cost, penalty_type, status",
        )
        .eq("venue_id", venueId!)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  // Need staff_id for grouping — separate query
  const { data: shiftsWithStaff, isLoading: staffShiftsLoading } = useQuery({
    queryKey: ["labourShiftsWithStaff", venueId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_shifts")
        .select(
          `
          staff_id, shift_date, start_time, end_time, break_duration_mins, status,
          staff!inner(
            id,
            org_members!inner(
              profiles!inner(first_name, last_name)
            )
          )
        `,
        )
        .eq("venue_id", venueId!)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const { data: timesheets, isLoading: tsLoading } = useQuery({
    queryKey: ["labourTimesheets", venueId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheets")
        .select("staff_id, work_date, total_hours, total_pay, status")
        .eq("venue_id", venueId!)
        .eq("status", "approved")
        .gte("work_date", from)
        .lte("work_date", to);
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const isLoading = shiftsLoading || staffShiftsLoading || tsLoading;

  const data = useMemo((): RosteredVsActualData => {
    if (!shiftsWithStaff)
      return { rows: [], totalRostered: 0, totalActual: 0, hasActual: false };

    const staffMap = new Map<
      string,
      { name: string; rostered: number; actual: number }
    >();

    for (const s of shiftsWithStaff) {
      const sid = s.staff_id;
      if (!staffMap.has(sid)) {
        const prof = (
          s.staff as {
            org_members: {
              profiles: { first_name: string; last_name: string };
            };
          }
        )?.org_members?.profiles;
        const name = prof
          ? `${prof.first_name} ${prof.last_name}`.trim()
          : "Unknown";
        staffMap.set(sid, { name, rostered: 0, actual: 0 });
      }
      const entry = staffMap.get(sid)!;
      entry.rostered += calcHours(
        s.start_time,
        s.end_time,
        s.break_duration_mins || 0,
      );
    }

    for (const t of timesheets || []) {
      if (!staffMap.has(t.staff_id)) {
        staffMap.set(t.staff_id, { name: t.staff_id, rostered: 0, actual: 0 });
      }
      staffMap.get(t.staff_id)!.actual += t.total_hours || 0;
    }

    const rows: RosteredVsActualRow[] = Array.from(staffMap.entries())
      .filter(([, v]) => v.rostered > 0 || v.actual > 0)
      .map(([staffId, v]) => ({
        staffId,
        staffName: v.name,
        rosteredHours: Math.round(v.rostered * 10) / 10,
        actualHours: Math.round(v.actual * 10) / 10,
        varianceHours: Math.round((v.actual - v.rostered) * 10) / 10,
        variancePct:
          v.rostered > 0
            ? Math.round(((v.actual - v.rostered) / v.rostered) * 100)
            : 0,
      }))
      .sort((a, b) => b.rosteredHours - a.rosteredHours);

    const totalRostered = rows.reduce((sum, r) => sum + r.rosteredHours, 0);
    const totalActual = rows.reduce((sum, r) => sum + r.actualHours, 0);
    const hasActual = (timesheets || []).length > 0;

    return { rows, totalRostered, totalActual, hasActual };
  }, [shiftsWithStaff, timesheets]);

  return { data, isLoading, error: null };
}

// ============================================================
// HOOK 4: OVERTIME
// ============================================================

export interface OvertimeRow {
  staffId: string;
  staffName: string;
  regularHours: number;
  otHours: number;
  otCost: number; // cents
  otTrigger: string;
}

export interface OvertimeData {
  rows: OvertimeRow[]; // only staff who triggered OT
  totalOtHours: number;
  totalOtCost: number; // cents
}

export function useOvertimeReport(
  venueId: string | undefined,
  dateRange: DateRange,
) {
  const from = format(dateRange.from, "yyyy-MM-dd");
  const to = format(dateRange.to, "yyyy-MM-dd");

  const {
    data: shiftsWithStaff,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["labourShiftsWithStaff", venueId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_shifts")
        .select(
          `
          staff_id, shift_date, start_time, end_time, break_duration_mins, estimated_cost, status,
          staff!inner(
            id,
            org_members!inner(
              profiles!inner(first_name, last_name)
            )
          )
        `,
        )
        .eq("venue_id", venueId!)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const data = useMemo((): OvertimeData => {
    if (!shiftsWithStaff || shiftsWithStaff.length === 0) {
      return { rows: [], totalOtHours: 0, totalOtCost: 0 };
    }

    // Group by staff → group by week → detect OT per week
    const OT_THRESHOLD = 38;

    const staffMap = new Map<
      string,
      {
        name: string;
        weeklyHours: Map<string, { hours: number; cost: number }>;
      }
    >();

    for (const s of shiftsWithStaff) {
      const sid = s.staff_id;
      if (!staffMap.has(sid)) {
        const prof = (
          s.staff as {
            org_members: {
              profiles: { first_name: string; last_name: string };
            };
          }
        )?.org_members?.profiles;
        const name = prof
          ? `${prof.first_name} ${prof.last_name}`.trim()
          : "Unknown";
        staffMap.set(sid, { name, weeklyHours: new Map() });
      }

      const shiftDate = new Date(s.shift_date);
      const weekKey = format(
        startOfWeek(shiftDate, { weekStartsOn: 1 }),
        "yyyy-MM-dd",
      );
      const entry = staffMap.get(sid)!;
      if (!entry.weeklyHours.has(weekKey)) {
        entry.weeklyHours.set(weekKey, { hours: 0, cost: 0 });
      }
      const week = entry.weeklyHours.get(weekKey)!;
      week.hours += calcHours(
        s.start_time,
        s.end_time,
        s.break_duration_mins || 0,
      );
      week.cost += (s.estimated_cost || 0) * 100;
    }

    const rows: OvertimeRow[] = [];

    for (const [staffId, staff] of staffMap.entries()) {
      let totalRegular = 0;
      let totalOt = 0;
      let totalOtCost = 0;

      for (const [, week] of staff.weeklyHours.entries()) {
        if (week.hours > OT_THRESHOLD) {
          const otHours = week.hours - OT_THRESHOLD;
          const hourlyRate = week.hours > 0 ? week.cost / week.hours : 0;
          totalOt += otHours;
          totalOtCost += otHours * hourlyRate;
          totalRegular += OT_THRESHOLD;
        } else {
          totalRegular += week.hours;
        }
      }

      if (totalOt > 0) {
        rows.push({
          staffId,
          staffName: staff.name,
          regularHours: Math.round(totalRegular * 10) / 10,
          otHours: Math.round(totalOt * 10) / 10,
          otCost: Math.round(totalOtCost),
          otTrigger: `>${OT_THRESHOLD}h/week (Fair Work)`,
        });
      }
    }

    rows.sort((a, b) => b.otHours - a.otHours);

    const totalOtHours = rows.reduce((sum, r) => sum + r.otHours, 0);
    const totalOtCost = rows.reduce((sum, r) => sum + r.otCost, 0);

    return { rows, totalOtHours, totalOtCost };
  }, [shiftsWithStaff]);

  return { data, isLoading, error };
}

// ============================================================
// HOOK 5: STAFF UTILIZATION
// ============================================================

export interface UtilizationRow {
  staffId: string;
  staffName: string;
  employmentType: string;
  contractedHours: number;
  rosteredHours: number;
  utilizationPct: number;
  flag: "under" | "over" | "ok" | "casual";
}

export interface UtilizationData {
  rows: UtilizationRow[];
  avgUtilization: number;
}

/** Contracted weekly hours by employment type */
const CONTRACTED_HOURS: Record<string, number> = {
  "full-time": 38,
  full_time: 38,
  "part-time": 20,
  part_time: 20,
  casual: 0,
};

export function useUtilizationReport(
  venueId: string | undefined,
  dateRange: DateRange,
) {
  const from = format(dateRange.from, "yyyy-MM-dd");
  const to = format(dateRange.to, "yyyy-MM-dd");

  const { data: staffList, isLoading: staffLoading } = useQuery({
    queryKey: ["staffList", venueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select(
          `
          id, venue_id, employment_type, status,
          org_members!inner(
            is_active,
            profiles!inner(first_name, last_name)
          )
        `,
        )
        .eq("venue_id", venueId!);
      if (error) throw error;
      return (data || []).filter(
        (s) => (s.org_members as { is_active: boolean })?.is_active !== false,
      );
    },
    enabled: !!venueId,
  });

  const { data: shiftsWithStaff, isLoading: shiftsLoading } = useQuery({
    queryKey: ["labourShiftsWithStaff", venueId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roster_shifts")
        .select(
          `
          staff_id, shift_date, start_time, end_time, break_duration_mins, estimated_cost, status,
          staff!inner(
            id,
            org_members!inner(
              profiles!inner(first_name, last_name)
            )
          )
        `,
        )
        .eq("venue_id", venueId!)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const isLoading = staffLoading || shiftsLoading;

  const data = useMemo((): UtilizationData => {
    if (!staffList || !shiftsWithStaff) return { rows: [], avgUtilization: 0 };

    // Number of weeks in the period
    const days = differenceInCalendarDays(dateRange.to, dateRange.from) + 1;
    const weeks = Math.max(1, days / 7);

    // Hours per staff
    const hoursMap = new Map<string, number>();
    for (const s of shiftsWithStaff) {
      const h = calcHours(s.start_time, s.end_time, s.break_duration_mins || 0);
      hoursMap.set(s.staff_id, (hoursMap.get(s.staff_id) || 0) + h);
    }

    const rows: UtilizationRow[] = staffList
      .map((staff) => {
        const prof = (
          staff.org_members as {
            profiles: { first_name: string; last_name: string };
          }
        )?.profiles;
        const name = prof
          ? `${prof.first_name} ${prof.last_name}`.trim()
          : "Unknown";
        const empType = staff.employment_type || "casual";
        const weeklyContracted = CONTRACTED_HOURS[empType] || 0;
        const contractedHours = weeklyContracted * weeks;
        const rosteredHours =
          Math.round((hoursMap.get(staff.id) || 0) * 10) / 10;

        let utilizationPct = 0;
        let flag: UtilizationRow["flag"] = "casual";
        if (contractedHours > 0) {
          utilizationPct = Math.round((rosteredHours / contractedHours) * 100);
          flag =
            utilizationPct < 70
              ? "under"
              : utilizationPct > 100
                ? "over"
                : "ok";
        }

        return {
          staffId: staff.id,
          staffName: name,
          employmentType: empType.replace("_", "-"),
          contractedHours: Math.round(contractedHours * 10) / 10,
          rosteredHours,
          utilizationPct,
          flag,
        };
      })
      .filter((r) => r.rosteredHours > 0 || r.contractedHours > 0)
      .sort((a, b) => b.utilizationPct - a.utilizationPct);

    const nonCasual = rows.filter((r) => r.flag !== "casual");
    const avgUtilization =
      nonCasual.length > 0
        ? Math.round(
            nonCasual.reduce((sum, r) => sum + r.utilizationPct, 0) /
              nonCasual.length,
          )
        : 0;

    return { rows, avgUtilization };
  }, [staffList, shiftsWithStaff, dateRange]);

  return { data, isLoading, error: null };
}

// ============================================================
// RE-EXPORT FOR CONVENIENCE
// ============================================================

export type { DateRange as LabourDateRange };
