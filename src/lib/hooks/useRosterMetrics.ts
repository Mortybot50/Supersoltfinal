import { useMemo } from "react";
import { useDataStore } from "@/lib/store/dataStore";
import {
  getWeekStart,
  getShiftsForWeek,
  calculateWeeklyRosterMetrics,
  detectOvertimeWarnings,
  detectRestGapWarnings,
  detectBreakWarnings,
  calculateBudgetVariance,
  formatLabourCost,
} from "@/lib/utils/rosterCalculations";
import { RosterShift } from "@/types";

export function useRosterMetrics() {
  const {
    staff,
    rosterShifts,
    timesheets,
    laborBudgets,
    getLaborBudgetForWeek,
  } = useDataStore();

  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);

  const weekShifts = useMemo(
    () => getShiftsForWeek(rosterShifts, currentWeekStart),
    [rosterShifts, currentWeekStart],
  );

  const metrics = useMemo(
    () => calculateWeeklyRosterMetrics(weekShifts),
    [weekShifts],
  );

  const currentBudget = useMemo(
    () => getLaborBudgetForWeek(currentWeekStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWeekStart, laborBudgets], // getLaborBudgetForWeek is a stable Zustand selector
  );

  const budgetVariance = useMemo(
    () => calculateBudgetVariance(currentBudget, metrics.totalCost),
    [currentBudget, metrics.totalCost],
  );

  const overtimeWarnings = useMemo(
    () => detectOvertimeWarnings(weekShifts),
    [weekShifts],
  );
  const restGapWarnings = useMemo(
    () => detectRestGapWarnings(weekShifts),
    [weekShifts],
  );
  const breakWarnings = useMemo(
    () => detectBreakWarnings(weekShifts),
    [weekShifts],
  );

  const allWarningsCount = useMemo(
    () =>
      overtimeWarnings.length + restGapWarnings.length + breakWarnings.length,
    [overtimeWarnings, restGapWarnings, breakWarnings],
  );

  const draftShiftCount = useMemo(
    () => weekShifts.filter((s) => s.status === "scheduled").length,
    [weekShifts],
  );

  const confirmedShiftCount = useMemo(
    () => weekShifts.filter((s) => s.status === "confirmed").length,
    [weekShifts],
  );

  const pendingTimesheetCount = useMemo(
    () => timesheets.filter((t) => t.status === "pending").length,
    [timesheets],
  );

  const approvedTimesheetHours = useMemo(
    () =>
      timesheets
        .filter((t) => t.status === "approved")
        .reduce((sum, t) => sum + t.total_hours, 0),
    [timesheets],
  );

  const getUpcomingShiftsForStaff = (staffId: string): RosterShift[] => {
    const today = new Date().toISOString().split("T")[0];
    return rosterShifts
      .filter((s) => {
        const shiftDate = new Date(s.date).toISOString().split("T")[0];
        return (
          s.staff_id === staffId &&
          shiftDate >= today &&
          s.status !== "cancelled"
        );
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getRosteredShiftForStaffOnDate = (
    staffId: string,
    date: Date,
  ): RosterShift | null => {
    const dateStr = date.toISOString().split("T")[0];
    return (
      rosterShifts.find((s) => {
        const shiftDate = new Date(s.date).toISOString().split("T")[0];
        return (
          s.staff_id === staffId &&
          shiftDate === dateStr &&
          s.status !== "cancelled"
        );
      }) || null
    );
  };

  return {
    currentWeekStart,
    weekShifts,
    metrics,
    currentBudget,
    budgetVariance,
    allWarningsCount,
    draftShiftCount,
    confirmedShiftCount,
    pendingTimesheetCount,
    approvedTimesheetHours,
    getUpcomingShiftsForStaff,
    getRosteredShiftForStaffOnDate,
    formatLabourCost,
  };
}
