/**
 * useLabourCost — hook for calculating labour cost vs revenue metrics.
 *
 * Fetches last 4 weeks of POS order revenue for the current venue,
 * calculates average weekly revenue, and provides labour cost as %.
 *
 * ⚠️ All labour costs are ESTIMATED based on simplified award rates.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRosterStore } from "@/stores/useRosterStore";
import { RosterShift } from "@/types";
import { getWeekDates } from "@/lib/utils/rosterCalculations";
import { format, subWeeks } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DayCostBreakdown {
  date: Date;
  dateStr: string;
  dayLabel: string;
  totalCostCents: number;
  baseCostCents: number;
  penaltyCostCents: number;
  totalHours: number;
  shiftCount: number;
  staffCount: number;
}

export interface LabourCostMetrics {
  /** Total weekly labour cost in cents */
  weeklyLabourCostCents: number;
  /** Average weekly revenue in cents (last 4 weeks from POS) */
  avgWeeklyRevenueCents: number | null;
  /** Labour cost as % of revenue */
  labourPercent: number | null;
  /** Per-day breakdown */
  dailyBreakdown: DayCostBreakdown[];
  /** Colour code based on thresholds */
  costStatus: "green" | "amber" | "red" | "unknown";
  /** Whether revenue data is available */
  hasRevenueData: boolean;
  /** Loading state */
  isLoadingRevenue: boolean;
  /** All costs are estimates */
  isEstimate: true;
}

// ── Default thresholds ───────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS = {
  green: 28, // <28% = green
  amber: 32, // 28-32% = amber
  // >32% = red
};

// ── Revenue fetcher ──────────────────────────────────────────────────────────

async function fetchWeeklyRevenue(
  venueId: string,
  weeksBack: number = 4,
): Promise<{ weekStart: string; totalCents: number }[]> {
  const endDate = new Date();
  const startDate = subWeeks(endDate, weeksBack);

  const { data, error } = await supabase
    .from("orders")
    .select("net_amount, order_datetime")
    .eq("venue_id", venueId)
    .eq("is_void", false)
    .eq("is_refund", false)
    .gte("order_datetime", format(startDate, "yyyy-MM-dd"))
    .lte("order_datetime", format(endDate, "yyyy-MM-dd"))
    .order("order_datetime", { ascending: true });

  if (error) {
    console.warn("[useLabourCost] Failed to fetch revenue:", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Group by ISO week (Mon–Sun)
  const weekMap = new Map<string, number>();

  for (const order of data) {
    const orderDate = new Date(order.order_datetime);
    const day = orderDate.getDay();
    const diff = orderDate.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(orderDate);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekKey = format(weekStart, "yyyy-MM-dd");

    const amountCents = Math.round((order.net_amount || 0) * 100);
    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + amountCents);
  }

  return Array.from(weekMap.entries()).map(([weekStart, totalCents]) => ({
    weekStart,
    totalCents,
  }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLabourCost(): LabourCostMetrics {
  const { currentVenue } = useAuth();
  const { shifts, selectedDate } = useRosterStore();
  const venueId = currentVenue?.id;

  // Fetch revenue data
  const { data: weeklyRevenue, isLoading: isLoadingRevenue } = useQuery({
    queryKey: ["weeklyRevenue", venueId],
    queryFn: () => fetchWeeklyRevenue(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Calculate average weekly revenue
  const avgWeeklyRevenueCents = useMemo(() => {
    if (!weeklyRevenue || weeklyRevenue.length === 0) return null;
    const total = weeklyRevenue.reduce((sum, w) => sum + w.totalCents, 0);
    return Math.round(total / weeklyRevenue.length);
  }, [weeklyRevenue]);

  // Calculate per-day breakdown
  const dailyBreakdown = useMemo((): DayCostBreakdown[] => {
    const weekDates = getWeekDates(selectedDate);
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return weekDates.map((date, i) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayShifts = shifts.filter((s: RosterShift) => {
        const shiftDate = s.date instanceof Date ? s.date : new Date(s.date);
        return (
          format(shiftDate, "yyyy-MM-dd") === dateStr &&
          s.status !== "cancelled"
        );
      });

      const uniqueStaff = new Set(
        dayShifts.map((s: RosterShift) => s.staff_id),
      );

      return {
        date,
        dateStr,
        dayLabel: dayNames[i],
        totalCostCents: dayShifts.reduce(
          (sum: number, s: RosterShift) => sum + s.total_cost,
          0,
        ),
        baseCostCents: dayShifts.reduce(
          (sum: number, s: RosterShift) => sum + (s.base_cost || s.total_cost),
          0,
        ),
        penaltyCostCents: dayShifts.reduce(
          (sum: number, s: RosterShift) => sum + (s.penalty_cost || 0),
          0,
        ),
        totalHours: dayShifts.reduce(
          (sum: number, s: RosterShift) => sum + s.total_hours,
          0,
        ),
        shiftCount: dayShifts.length,
        staffCount: uniqueStaff.size,
      };
    });
  }, [shifts, selectedDate]);

  // Total weekly cost
  const weeklyLabourCostCents = useMemo(
    () => dailyBreakdown.reduce((sum, d) => sum + d.totalCostCents, 0),
    [dailyBreakdown],
  );

  // Labour %
  const labourPercent = useMemo(() => {
    if (!avgWeeklyRevenueCents || avgWeeklyRevenueCents === 0) return null;
    return (
      Math.round((weeklyLabourCostCents / avgWeeklyRevenueCents) * 10000) / 100
    );
  }, [weeklyLabourCostCents, avgWeeklyRevenueCents]);

  // Cost status colour
  const costStatus = useMemo((): LabourCostMetrics["costStatus"] => {
    if (labourPercent === null) return "unknown";
    if (labourPercent < DEFAULT_THRESHOLDS.green) return "green";
    if (labourPercent <= DEFAULT_THRESHOLDS.amber) return "amber";
    return "red";
  }, [labourPercent]);

  return {
    weeklyLabourCostCents,
    avgWeeklyRevenueCents,
    labourPercent,
    dailyBreakdown,
    costStatus,
    hasRevenueData: !!avgWeeklyRevenueCents && avgWeeklyRevenueCents > 0,
    isLoadingRevenue,
    isEstimate: true,
  };
}
