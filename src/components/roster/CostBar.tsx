/**
 * CostBar — sticky live cost bar showing total labour $, hours, penalty breakdown.
 * Click to expand for per-role / per-daypart / per-day breakdown (CostBarExpanded).
 *
 * ⚠️ All costs are ESTIMATED based on simplified AU award rates.
 */

import { useMemo } from "react";
import { useRosterStore } from "@/stores/useRosterStore";
import { useLabourCost } from "@/lib/hooks/useLabourCost";
import { formatCurrency } from "@/lib/utils/formatters";
import { calculateWeeklyRosterMetrics } from "@/lib/utils/rosterCalculations";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS = {
  green: "text-green-600",
  amber: "text-amber-600",
  red: "text-red-600",
  unknown: "text-gray-500",
} as const;

const STATUS_BG = {
  green: "bg-green-50",
  amber: "bg-amber-50",
  red: "bg-red-50",
  unknown: "bg-gray-50",
} as const;

export function CostBar() {
  const { shifts, costBarExpanded, toggleCostBar } = useRosterStore();
  const { labourPercent, costStatus, isLoadingRevenue } = useLabourCost();

  const metrics = useMemo(() => calculateWeeklyRosterMetrics(shifts), [shifts]);

  const hasPenalties = metrics.penaltyCost > 0;

  return (
    <div className="shrink-0 bg-white border-t shadow-sm print:hidden">
      {/* Main bar */}
      <button
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
        onClick={toggleCostBar}
      >
        <DollarSign className="h-4 w-4 text-teal-500 shrink-0" />

        {/* Total cost */}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tabular-nums">
            {formatCurrency(metrics.totalCost)}
          </span>
          <span className="text-[10px] text-gray-400">est. labour</span>
        </div>

        <div className="w-px h-8 bg-gray-100" />

        {/* Hours */}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tabular-nums">
            {metrics.totalHours.toFixed(1)}h
          </span>
          <span className="text-[10px] text-gray-400">
            {metrics.shiftCount} shifts
          </span>
        </div>

        <div className="w-px h-8 bg-gray-100" />

        {/* Staff */}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tabular-nums">
            {metrics.staffCount}
          </span>
          <span className="text-[10px] text-gray-400">staff rostered</span>
        </div>

        {/* Penalty breakdown */}
        {hasPenalties && (
          <>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tabular-nums text-orange-600">
                +{formatCurrency(metrics.penaltyCost)}
              </span>
              <span className="text-[10px] text-gray-400">penalties</span>
            </div>
          </>
        )}

        {/* Labour % of revenue */}
        <div className="w-px h-8 bg-gray-100" />
        {isLoadingRevenue ? (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
            <span className="text-[10px] text-gray-400">
              loading revenue...
            </span>
          </div>
        ) : labourPercent !== null ? (
          <div
            className={cn(
              "flex flex-col leading-tight px-2 py-0.5 rounded",
              STATUS_BG[costStatus],
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                STATUS_COLORS[costStatus],
              )}
            >
              {labourPercent.toFixed(1)}%
            </span>
            <span className="text-[10px] text-gray-400">of avg revenue</span>
          </div>
        ) : (
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-gray-400 italic">No POS data</span>
            <span className="text-[10px] text-gray-400">labour %</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Estimate badge */}
        <div className="hidden md:flex items-center gap-1 text-[10px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
          <AlertTriangle className="h-3 w-3" />
          Estimated
        </div>

        {/* Avg rate */}
        {metrics.avgHourlyRate > 0 && (
          <div className="text-xs text-gray-400 hidden md:block">
            avg {formatCurrency(metrics.avgHourlyRate)}/h
          </div>
        )}

        {costBarExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        )}
      </button>
    </div>
  );
}
