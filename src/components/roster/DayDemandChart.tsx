import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { HourlyStaffing, DayStats } from "@/types"
import { formatLabourCost, formatHours } from "@/lib/utils/rosterCalculations"
import type { DemandSlot } from "@/lib/hooks/useDemandForecast"

interface DayDemandChartProps {
  hourlyStaffing: HourlyStaffing[]
  dayStats: DayStats
  /** POS-derived demand slots. When provided, renders an orange dashed demand curve. */
  posSlots?: DemandSlot[]
}

const chartConfig: ChartConfig = {
  staffCount: {
    label: "Rostered Staff",
    color: "hsl(220, 70%, 60%)",
  },
  posDemand: {
    label: "POS Demand",
    color: "hsl(30, 90%, 55%)",
  },
  actualStaff: {
    label: "Actual Staff",
    color: "hsl(150, 60%, 45%)",
  },
}

export function DayDemandChart({ hourlyStaffing, dayStats, posSlots }: DayDemandChartProps) {
  // Merge hourlyStaffing with posSlots by slot index
  const data = hourlyStaffing.map((slot, i) => ({
    ...slot,
    displayLabel: slot.minute === 0 ? slot.label : "",
    posDemand: posSlots?.[i]?.demandStaff ?? null,
    // For today: actual = rostered (proxy). Future: replace with clock-in data.
    actualStaff: slot.staffCount,
  }))

  // Recommended hours = sum of (demandStaff * 0.5h) per slot
  const recommendedHours = posSlots
    ? posSlots.reduce((sum, s) => sum + s.demandStaff * 0.5, 0)
    : 0

  const variance = dayStats.totalHours - recommendedHours
  const variancePct = recommendedHours > 0 ? (Math.abs(variance) / recommendedHours) * 100 : null
  const varianceColor =
    variancePct === null
      ? "text-muted-foreground"
      : variancePct <= 10
      ? "text-green-600"
      : variancePct <= 20
      ? "text-amber-500"
      : "text-red-500"

  return (
    <div className="flex gap-4">
      {/* Left Stats Panel */}
      <div className="w-48 shrink-0 space-y-3 py-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Staff vs Demand
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500 opacity-60" />
            <span className="text-xs">Rostered staff</span>
          </div>
          {posSlots && (
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-0 border-t-2 border-dashed border-orange-500"
                style={{ display: "inline-block" }}
              />
              <span className="text-xs">POS demand</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-3 h-0 border-t-2 border-green-500" style={{ display: "inline-block" }} />
            <span className="text-xs">Actual</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Rostered hours</div>
            <div className="text-lg font-bold">{formatHours(dayStats.totalHours)}</div>
          </div>
          {posSlots && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Recommended</span>
                <span>{formatHours(recommendedHours)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Variance</span>
                <span className={`font-medium ${varianceColor}`}>
                  {variance >= 0 ? "+" : ""}
                  {formatHours(Math.abs(variance))}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Day cost</span>
            <span className="font-medium">{formatLabourCost(dayStats.totalCost)}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="displayLabel"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fontSize: 10 }}
              width={25}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    if (payload?.[0]?.payload) {
                      return payload[0].payload.label
                    }
                    return ""
                  }}
                />
              }
            />
            {/* Rostered staff — solid blue area */}
            <Area
              type="stepAfter"
              dataKey="staffCount"
              fill="hsl(220, 70%, 60%)"
              stroke="hsl(220, 70%, 60%)"
              fillOpacity={0.3}
              strokeWidth={1.5}
            />
            {/* POS demand — orange dashed line */}
            {posSlots && (
              <Line
                type="monotone"
                dataKey="posDemand"
                stroke="hsl(30, 90%, 55%)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
              />
            )}
            {/* Actual staff — green solid line (proxy: same as rostered) */}
            <Line
              type="stepAfter"
              dataKey="actualStaff"
              stroke="hsl(150, 60%, 45%)"
              strokeWidth={1.5}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  )
}
