import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertTriangle,
  MapPin,
  ChevronRight,
  Zap,
  MessageSquare,
  Wrench,
  TrendingUp,
} from "lucide-react"
import { formatLabourCost, formatHours } from "@/lib/utils/rosterCalculations"
import { DayStats, ShiftTemplate } from "@/types"
import { QuickBuildPopover } from "./QuickBuildPopover"

interface RosterSidebarProps {
  metrics: {
    totalHours: number
    totalCost: number
    shiftCount: number
    staffCount: number
    avgHourlyRate: number
    baseCost: number
    penaltyCost: number
  }
  allWarnings: Array<{ type: string }>
  pendingSwapCount: number
  salesForecast?: number
  dayStats?: DayStats
  shiftTemplates: ShiftTemplate[]
  onCopyPreviousWeek: () => void
  onApplyTemplate: (template: ShiftTemplate) => void
  onEventsComments: () => void
  onTools: () => void
}

export function RosterSidebar({
  metrics,
  allWarnings,
  pendingSwapCount,
  salesForecast,
  dayStats,
  shiftTemplates,
  onCopyPreviousWeek,
  onApplyTemplate,
  onEventsComments,
  onTools,
}: RosterSidebarProps) {
  const displayMetrics = dayStats
    ? {
        totalHours: dayStats.totalHours,
        totalCost: dayStats.totalCost,
        shiftCount: dayStats.shiftCount,
        avgHourlyRate: dayStats.avgHourlyRate,
        salesForecast: dayStats.salesForecast,
        sph: dayStats.sph,
        wagePercentRevenue: dayStats.wagePercentRevenue,
      }
    : {
        totalHours: metrics.totalHours,
        totalCost: metrics.totalCost,
        shiftCount: metrics.shiftCount,
        avgHourlyRate: metrics.avgHourlyRate,
        salesForecast: salesForecast ?? 500000,
        sph: metrics.totalHours > 0 ? Math.round((salesForecast ?? 500000) / metrics.totalHours) : 0,
        wagePercentRevenue:
          (salesForecast ?? 500000) > 0
            ? Math.round((metrics.totalCost / (salesForecast ?? 500000)) * 10000) / 100
            : 0,
      }

  return (
    <div className="w-48 bg-slate-800 text-white flex flex-col print:hidden shrink-0">
      {/* Location Selector */}
      <div className="p-4 border-b border-slate-700">
        <Button variant="ghost" className="w-full justify-start text-white hover:bg-slate-700 p-2">
          <MapPin className="h-4 w-4 mr-2" />
          <span className="font-medium">VENUE</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
          {dayStats ? "Day Stats" : "Roster Stats"}
        </div>

        <div>
          <div className="text-2xl font-bold">{formatHours(displayMetrics.totalHours)}</div>
          <div className="text-xs text-slate-400">Total Hours</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{formatLabourCost(displayMetrics.totalCost)}</div>
          <div className="text-xs text-slate-400">Total Cost</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{displayMetrics.shiftCount}</div>
          <div className="text-xs text-slate-400">Total Shifts</div>
        </div>
      </div>

      <Separator className="bg-slate-700" />

      {/* Extended Stats */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Avg Hourly Rate</span>
          <span className="text-sm font-medium">
            {formatLabourCost(displayMetrics.avgHourlyRate)}/h
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Sales Forecast</span>
          <span className="text-sm font-medium flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-400" />
            {formatLabourCost(displayMetrics.salesForecast)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">SPH</span>
          <span className="text-sm font-medium">
            {formatLabourCost(displayMetrics.sph)}/h
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Wage % Revenue</span>
          <span
            className={`text-sm font-medium ${
              displayMetrics.wagePercentRevenue > 35
                ? "text-red-400"
                : displayMetrics.wagePercentRevenue > 30
                ? "text-orange-400"
                : "text-green-400"
            }`}
          >
            {displayMetrics.wagePercentRevenue.toFixed(1)}%
          </span>
        </div>
      </div>

      <Separator className="bg-slate-700" />

      {/* Quick Actions */}
      <div className="p-2 space-y-1">
        <QuickBuildPopover
          shiftTemplates={shiftTemplates}
          onCopyPreviousWeek={onCopyPreviousWeek}
          onApplyTemplate={onApplyTemplate}
        >
          <Button
            variant="ghost"
            className="w-full justify-start text-white hover:bg-slate-700 text-sm"
          >
            <Zap className="h-4 w-4 mr-2" />
            Quick Build
          </Button>
        </QuickBuildPopover>
        <Button
          variant="ghost"
          className="w-full justify-start text-white hover:bg-slate-700 text-sm"
          onClick={onEventsComments}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Events & Comments
          {pendingSwapCount > 0 && (
            <Badge className="ml-auto bg-blue-500">{pendingSwapCount}</Badge>
          )}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start text-white hover:bg-slate-700 text-sm"
          onClick={onTools}
        >
          <Wrench className="h-4 w-4 mr-2" />
          Tools
        </Button>
      </div>

      {/* Warnings */}
      {allWarnings.length > 0 && (
        <>
          <Separator className="bg-slate-700" />
          <div className="p-4">
            <div className="flex items-center gap-2 text-orange-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{allWarnings.length} warnings</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
