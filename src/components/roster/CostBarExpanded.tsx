/**
 * CostBarExpanded — detailed cost breakdown panel.
 * Shows breakdown by role, daypart, per-day labour cost, and budget summary.
 *
 * ⚠️ All costs are ESTIMATED based on simplified AU award rates.
 */

import { useMemo } from "react";
import { useRosterStore, getRoleColors } from "@/stores/useRosterStore";
import { useLabourCost } from "@/lib/hooks/useLabourCost";
import { getDaypart, DAYPARTS } from "./DayPartBands";
import { formatCurrency } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, Calendar } from "lucide-react";

export function CostBarExpanded() {
  const { shifts, staff, costBarExpanded } = useRosterStore();
  const {
    weeklyLabourCostCents,
    avgWeeklyRevenueCents,
    labourPercent,
    dailyBreakdown,
    costStatus,
    hasRevenueData,
  } = useLabourCost();

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.status !== "cancelled"),
    [shifts],
  );

  // By role
  const byRole = useMemo(() => {
    const map: Record<string, { hours: number; cost: number; count: number }> =
      {};
    activeShifts.forEach((s) => {
      const r = s.role || "crew";
      if (!map[r]) map[r] = { hours: 0, cost: 0, count: 0 };
      map[r].hours += s.total_hours;
      map[r].cost += s.total_cost;
      map[r].count += 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b.cost - a.cost);
  }, [activeShifts]);

  // By daypart
  const byDaypart = useMemo(() => {
    const map: Record<string, { hours: number; cost: number; count: number }> =
      {};
    DAYPARTS.forEach((dp) => {
      map[dp.key] = { hours: 0, cost: 0, count: 0 };
    });
    activeShifts.forEach((s) => {
      const dp = getDaypart(s.start_time);
      map[dp].hours += s.total_hours;
      map[dp].cost += s.total_cost;
      map[dp].count += 1;
    });
    return DAYPARTS.map((dp) => ({ ...dp, ...map[dp.key] }));
  }, [activeShifts]);

  const totalCost = activeShifts.reduce((s, sh) => s + sh.total_cost, 0);

  if (!costBarExpanded) return null;

  const statusColors = {
    green: "text-green-600 bg-green-50 border-green-200",
    amber: "text-amber-600 bg-amber-50 border-amber-200",
    red: "text-red-600 bg-red-50 border-red-200",
    unknown: "text-gray-600 bg-gray-50 border-gray-200",
  };

  return (
    <div className="bg-white border-t border-gray-100 px-4 py-3 space-y-3 max-h-72 overflow-y-auto print:hidden">
      {/* Budget Summary Banner */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg border",
          statusColors[costStatus],
        )}
      >
        <TrendingUp className="h-4 w-4 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold">
            Estimated labour cost: {formatCurrency(weeklyLabourCostCents)}
            {labourPercent !== null && (
              <span className="ml-1">
                ({labourPercent.toFixed(1)}% of avg revenue)
              </span>
            )}
          </div>
          {hasRevenueData && avgWeeklyRevenueCents ? (
            <div className="text-[10px] opacity-70">
              Based on avg weekly revenue of{" "}
              {formatCurrency(avgWeeklyRevenueCents)} (last 4 weeks POS data)
            </div>
          ) : (
            <div className="text-[10px] opacity-70">
              No POS revenue data available — connect Square to see labour %
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] opacity-60">
          <AlertTriangle className="h-3 w-3" />
          Estimated
        </div>
      </div>

      {/* Per-Day Breakdown */}
      <div>
        <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Daily Breakdown
        </h4>
        <div className="grid grid-cols-7 gap-1">
          {dailyBreakdown.map((day) => {
            const maxCost = Math.max(
              ...dailyBreakdown.map((d) => d.totalCostCents),
              1,
            );
            const barHeight =
              day.totalCostCents > 0
                ? Math.max(8, (day.totalCostCents / maxCost) * 40)
                : 0;
            const hasPenalty = day.penaltyCostCents > 0;

            return (
              <div
                key={day.dateStr}
                className="flex flex-col items-center gap-0.5"
              >
                <span className="text-[10px] font-medium text-gray-500">
                  {day.dayLabel}
                </span>
                <div className="w-full h-10 flex items-end justify-center">
                  {day.totalCostCents > 0 ? (
                    <div className="flex flex-col items-center w-full">
                      <div
                        className={cn(
                          "w-full rounded-t",
                          hasPenalty ? "bg-orange-400" : "bg-teal-400",
                        )}
                        style={{ height: `${barHeight}px` }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-1 bg-gray-100 rounded" />
                  )}
                </div>
                <span className="text-[10px] font-semibold tabular-nums">
                  {day.totalCostCents > 0
                    ? formatCurrency(day.totalCostCents)
                    : "—"}
                </span>
                <span className="text-[9px] text-gray-400 tabular-nums">
                  {day.totalHours > 0 ? `${day.totalHours.toFixed(1)}h` : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Existing breakdowns (role + daypart) */}
      <div className="grid grid-cols-2 gap-4">
        {/* By Role */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            By Role
          </h4>
          <div className="space-y-1">
            {byRole.map(([role, stats]) => {
              const colors = getRoleColors(role);
              const pct = totalCost > 0 ? (stats.cost / totalCost) * 100 : 0;
              return (
                <div key={role} className="flex items-center gap-2">
                  <div
                    className={cn("h-2 w-2 rounded-full shrink-0", colors.dot)}
                  />
                  <span className="text-xs capitalize flex-1 truncate">
                    {role}
                  </span>
                  <span className="text-xs tabular-nums font-medium">
                    {formatCurrency(stats.cost)}
                  </span>
                  <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", colors.dot)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Daypart */}
        <div>
          <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            By Daypart
          </h4>
          <div className="space-y-1">
            {byDaypart.map((dp) => {
              const pct = totalCost > 0 ? (dp.cost / totalCost) * 100 : 0;
              return (
                <div key={dp.key} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      dp.color.replace("bg-", "bg-").replace("-50", "-400"),
                    )}
                  />
                  <span className="text-xs flex-1">{dp.label}</span>
                  <span className="text-xs tabular-nums font-medium">
                    {formatCurrency(dp.cost)}
                  </span>
                  <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        dp.color.replace("-50", "-400"),
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
