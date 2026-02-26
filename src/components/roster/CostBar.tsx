/**
 * CostBar — sticky live cost bar showing total labour $, hours, penalty breakdown.
 * Click to expand for per-role / per-daypart breakdown (CostBarExpanded).
 */

import { useMemo } from 'react'
import { useRosterStore } from '@/stores/useRosterStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { calculateWeeklyRosterMetrics } from '@/lib/utils/rosterCalculations'
import { ChevronDown, ChevronUp, TrendingUp, Clock, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CostBar() {
  const { shifts, costBarExpanded, toggleCostBar } = useRosterStore()

  const metrics = useMemo(() => calculateWeeklyRosterMetrics(shifts), [shifts])

  const labourPct = useMemo(() => {
    // Placeholder: labour% vs revenue not available yet (commit 6 adds sales forecast)
    return null
  }, [])

  const hasPenalties = metrics.penaltyCost > 0

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
          <span className="text-sm font-bold tabular-nums">{formatCurrency(metrics.totalCost)}</span>
          <span className="text-[10px] text-gray-400">total labour</span>
        </div>

        <div className="w-px h-8 bg-gray-100" />

        {/* Hours */}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tabular-nums">{metrics.totalHours.toFixed(1)}h</span>
          <span className="text-[10px] text-gray-400">{metrics.shiftCount} shifts</span>
        </div>

        <div className="w-px h-8 bg-gray-100" />

        {/* Staff */}
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tabular-nums">{metrics.staffCount}</span>
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

        {/* Labour % placeholder */}
        {labourPct !== null && (
          <>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col leading-tight">
              <span className={cn('text-sm font-semibold tabular-nums', labourPct > 35 ? 'text-red-600' : 'text-green-600')}>
                {labourPct.toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-400">of revenue</span>
            </div>
          </>
        )}

        <div className="flex-1" />

        {/* Avg rate */}
        {metrics.avgHourlyRate > 0 && (
          <div className="text-xs text-gray-400 hidden md:block">
            avg {formatCurrency(metrics.avgHourlyRate)}/h
          </div>
        )}

        {costBarExpanded
          ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>
    </div>
  )
}
