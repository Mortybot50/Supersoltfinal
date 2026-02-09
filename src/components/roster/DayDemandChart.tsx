import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { HourlyStaffing, DayStats } from "@/types"
import { formatLabourCost, formatHours } from "@/lib/utils/rosterCalculations"

interface DayDemandChartProps {
  hourlyStaffing: HourlyStaffing[]
  dayStats: DayStats
}

const chartConfig: ChartConfig = {
  predictedDemand: {
    label: "Predicted Demand",
    color: "hsl(220, 70%, 65%)",
  },
  staffCount: {
    label: "Actual Staffing",
    color: "hsl(350, 70%, 60%)",
  },
}

export function DayDemandChart({ hourlyStaffing, dayStats }: DayDemandChartProps) {
  // Only show labels at full hours (not half hours) to reduce clutter
  const data = hourlyStaffing.map((slot) => ({
    ...slot,
    displayLabel: slot.minute === 0 ? slot.label : "",
  }))

  return (
    <div className="flex gap-4">
      {/* Left Stats Panel */}
      <div className="w-48 shrink-0 space-y-3 py-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Configure Demand
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-400" />
            <span className="text-sm">Total Staff</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-rose-400" />
            <span className="text-sm">Actual</span>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div>
            <div className="text-sm font-medium">Rostered hours</div>
            <div className="text-lg font-bold">{formatHours(dayStats.totalHours)}</div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Recommended</span>
            <span>0h</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Variance</span>
            <span className="text-red-500 font-medium">{formatHours(dayStats.totalHours)}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
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
            <Bar
              dataKey="predictedDemand"
              fill="var(--color-predictedDemand)"
              radius={[2, 2, 0, 0]}
              opacity={0.3}
            />
            <Bar
              dataKey="staffCount"
              fill="var(--color-staffCount)"
              radius={[2, 2, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="staffCount"
              stroke="hsl(150, 60%, 50%)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  )
}
