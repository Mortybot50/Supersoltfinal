import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts"
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  Download,
  Percent,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import {
  useLabourCostReport,
  useLabourPercentReport,
  useRosteredVsActualReport,
  useOvertimeReport,
} from "@/lib/hooks/useLabourReports"
import { formatLabourCost } from "@/lib/utils/rosterCalculations"
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns"
import { PageShell, PageToolbar } from "@/components/shared"

// ============================================================
// CONSTANTS & TYPES
// ============================================================

type ReportType = "labour-cost" | "labour-percent" | "rostered-vs-actual" | "overtime"
type DatePreset = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month"

const BRAND_TEAL = "#14b8a6"
const CHART_ORANGE = "#f97316"
const CHART_BLUE = "#3b82f6"
const CHART_PURPLE = "#a855f7"

const TARGET_LABOUR_PCT = 30

interface ReportDef {
  id: ReportType
  title: string
  description: string
  icon: React.ElementType
  color: string
}

const REPORTS: ReportDef[] = [
  {
    id: "labour-cost",
    title: "Hours & Cost",
    description: "Ordinary vs penalty costs per day",
    icon: DollarSign,
    color: "text-teal-600",
  },
  {
    id: "labour-percent",
    title: "Labour %",
    description: "Cost as % of revenue — the killer metric",
    icon: Percent,
    color: "text-blue-600",
  },
  {
    id: "rostered-vs-actual",
    title: "Rostered vs Actual",
    description: "Scheduled hours vs time-clock hours",
    icon: BarChart3,
    color: "text-purple-600",
  },
  {
    id: "overtime",
    title: "Overtime",
    description: "Staff who exceeded 38h/week (Fair Work)",
    icon: AlertTriangle,
    color: "text-orange-600",
  },
]

// ============================================================
// DATE HELPERS
// ============================================================

function getDateRange(preset: DatePreset): { from: Date; to: Date } {
  const now = new Date()
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) }
    case "yesterday": {
      const y = subDays(now, 1)
      return { from: startOfDay(y), to: endOfDay(y) }
    }
    case "this-week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
    case "last-week": {
      const prev = subWeeks(now, 1)
      return { from: startOfWeek(prev, { weekStartsOn: 1 }), to: endOfWeek(prev, { weekStartsOn: 1 }) }
    }
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now) }
    case "last-month": {
      const prev = subMonths(now, 1)
      return { from: startOfMonth(prev), to: endOfMonth(prev) }
    }
  }
}

function formatDateLabel(from: Date, to: Date): string {
  if (format(from, "yyyy-MM-dd") === format(to, "yyyy-MM-dd")) {
    return format(from, "d MMM yyyy")
  }
  return `${format(from, "d MMM")} – ${format(to, "d MMM yyyy")}`
}

// ============================================================
// CSV EXPORT
// ============================================================

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(",") ? `"${s}"` : s
  }
  const content = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n")
  const blob = new Blob([content], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// SKELETON LOADER
// ============================================================

function ReportSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  )
}

// ============================================================
// REPORT: LABOUR HOURS & COST
// ============================================================

function LabourCostReport({
  venueId,
  dateRange,
  venueName,
  rangeLabel,
}: {
  venueId: string
  dateRange: { from: Date; to: Date }
  venueName: string
  rangeLabel: string
}) {
  const { data, isLoading } = useLabourCostReport(venueId, dateRange)

  const chartData = data.days.map(d => ({
    label: d.label,
    "Base Pay": Math.round(d.baseCost / 100),
    "Penalty": Math.round(d.penaltyCost / 100),
    "Hours": Math.round(d.totalHours * 10) / 10,
  }))

  const handleExport = () => {
    downloadCSV(
      ["Period", "Total Hours", "Base Cost ($)", "Penalty Cost ($)", "Total Cost ($)"],
      data.days.map(d => [
        d.date,
        d.totalHours.toFixed(2),
        (d.baseCost / 100).toFixed(2),
        (d.penaltyCost / 100).toFixed(2),
        (d.totalCost / 100).toFixed(2),
      ]),
      `supersolt_labour-cost_${venueName}_${rangeLabel}.csv`
    )
  }

  if (isLoading) return <ReportSkeleton />

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-bold">{data.totalHours.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">{data.shiftCount} shifts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-2xl font-bold">{formatLabourCost(data.totalCost)}</p>
            <p className="text-xs text-muted-foreground">${data.avgHourlyRate.toFixed(2)}/hr avg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Base Pay</p>
            <p className="text-2xl font-bold text-teal-600">{formatLabourCost(data.baseCost)}</p>
            <p className="text-xs text-muted-foreground">
              {data.totalCost > 0 ? Math.round((data.baseCost / data.totalCost) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Penalty Loading</p>
            <p className="text-2xl font-bold text-orange-600">{formatLabourCost(data.penaltyCost)}</p>
            <p className="text-xs text-muted-foreground">
              {data.totalCost > 0 ? Math.round((data.penaltyCost / data.totalCost) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Daily Labour Cost</CardTitle>
            <CardDescription>Base pay vs penalty loading per day</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No shifts in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="cost" tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="hours" orientation="right" tickFormatter={v => `${v}h`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "Hours") return [`${value}h`, name]
                    return [`$${Number(value).toFixed(2)}`, name]
                  }}
                />
                <Legend />
                <Bar yAxisId="cost" dataKey="Base Pay" stackId="cost" fill={BRAND_TEAL} />
                <Bar yAxisId="cost" dataKey="Penalty" stackId="cost" fill={CHART_ORANGE} />
                <Line yAxisId="hours" type="monotone" dataKey="Hours" stroke={CHART_BLUE} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Hours</TableHead>
                <TableHead className="text-right">Base Cost</TableHead>
                <TableHead className="text-right">Penalty Cost</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.days.filter(d => d.totalCost > 0 || d.totalHours > 0).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No shifts in this period
                  </TableCell>
                </TableRow>
              ) : (
                data.days
                  .filter(d => d.totalCost > 0 || d.totalHours > 0)
                  .map(d => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium">{format(new Date(d.date), "EEE d MMM")}</TableCell>
                      <TableCell className="text-right">{d.totalHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right">{formatLabourCost(d.baseCost)}</TableCell>
                      <TableCell className="text-right text-orange-600">
                        {d.penaltyCost > 0 ? formatLabourCost(d.penaltyCost) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatLabourCost(d.totalCost)}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// REPORT: LABOUR % (COST / REVENUE)
// ============================================================

function LabourPercentReport({
  venueId,
  dateRange,
  venueName,
  rangeLabel,
}: {
  venueId: string
  dateRange: { from: Date; to: Date }
  venueName: string
  rangeLabel: string
}) {
  const { data, isLoading } = useLabourPercentReport(venueId, dateRange)

  const chartData = data.rows.map(d => ({
    label: d.label,
    "Revenue": Math.round(d.revenue / 100),
    "Labour Cost": Math.round(d.labourCost / 100),
    "Labour %": Math.round(d.labourPercent * 10) / 10,
    "Target %": TARGET_LABOUR_PCT,
  }))

  const isOver = data.labourPercent > TARGET_LABOUR_PCT

  const handleExport = () => {
    downloadCSV(
      ["Period", "Revenue ($)", "Labour Cost ($)", "Labour %", "Target %"],
      data.rows.map(d => [
        d.date,
        (d.revenue / 100).toFixed(2),
        (d.labourCost / 100).toFixed(2),
        d.labourPercent.toFixed(1),
        TARGET_LABOUR_PCT,
      ]),
      `supersolt_labour-percent_${venueName}_${rangeLabel}.csv`
    )
  }

  if (isLoading) return <ReportSkeleton />

  return (
    <div className="space-y-6 w-full">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-2xl font-bold">{formatLabourCost(data.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">net sales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Labour Cost</p>
            <p className="text-2xl font-bold">{formatLabourCost(data.totalLabourCost)}</p>
            <p className="text-xs text-muted-foreground">total rostered cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Labour %</p>
            <p className={`text-2xl font-bold ${isOver ? "text-red-600" : "text-green-600"}`}>
              {data.hasRevenue ? `${data.labourPercent.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">target {TARGET_LABOUR_PCT}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">vs Target</p>
            <p className={`text-2xl font-bold ${isOver ? "text-red-600" : "text-green-600"}`}>
              {data.hasRevenue
                ? `${isOver ? "+" : ""}${(data.labourPercent - TARGET_LABOUR_PCT).toFixed(1)}%`
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{isOver ? "over target" : "within target"}</p>
          </CardContent>
        </Card>
      </div>

      {!data.hasRevenue && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 shrink-0" />
              No POS revenue data for this period. Connect a POS integration to unlock Labour % reporting.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Revenue vs Labour Cost</CardTitle>
            <CardDescription>
              Bars = revenue & cost · Line = labour % · Dashed = {TARGET_LABOUR_PCT}% target
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No data in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="dollars" tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "Labour %" || name === "Target %") return [`${value}%`, name]
                    return [`$${Number(value).toFixed(2)}`, name]
                  }}
                />
                <Legend />
                <Bar yAxisId="dollars" dataKey="Revenue" fill={BRAND_TEAL} opacity={0.7} />
                <Bar yAxisId="dollars" dataKey="Labour Cost" fill={CHART_BLUE} />
                <Line yAxisId="pct" type="monotone" dataKey="Labour %" stroke={CHART_ORANGE} strokeWidth={2} dot={false} />
                <Line yAxisId="pct" type="monotone" dataKey="Target %" stroke="#9ca3af" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Labour %</CardTitle>
          <CardDescription>Periods over target are highlighted</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Labour Cost</TableHead>
                <TableHead className="text-right">Labour %</TableHead>
                <TableHead className="text-right">Target %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.filter(d => d.labourCost > 0 || d.revenue > 0).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No data in this period
                  </TableCell>
                </TableRow>
              ) : (
                data.rows
                  .filter(d => d.labourCost > 0 || d.revenue > 0)
                  .map(d => (
                    <TableRow key={d.date} className={d.labourPercent > TARGET_LABOUR_PCT ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                      <TableCell className="font-medium">{format(new Date(d.date), "EEE d MMM")}</TableCell>
                      <TableCell className="text-right">{d.revenue > 0 ? formatLabourCost(d.revenue) : "—"}</TableCell>
                      <TableCell className="text-right">{formatLabourCost(d.labourCost)}</TableCell>
                      <TableCell className="text-right">
                        {d.revenue > 0 ? (
                          <span className={d.labourPercent > TARGET_LABOUR_PCT ? "text-red-600 font-semibold" : "text-green-600"}>
                            {d.labourPercent.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{TARGET_LABOUR_PCT}%</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// REPORT: ROSTERED VS ACTUAL
// ============================================================

function RosteredVsActualReport({
  venueId,
  dateRange,
  venueName,
  rangeLabel,
}: {
  venueId: string
  dateRange: { from: Date; to: Date }
  venueName: string
  rangeLabel: string
}) {
  const { data, isLoading } = useRosteredVsActualReport(venueId, dateRange)

  const chartData = data.rows.slice(0, 15).map(r => ({
    name: r.staffName.split(" ")[0],
    "Rostered": r.rosteredHours,
    "Actual": r.actualHours,
  }))

  const handleExport = () => {
    downloadCSV(
      ["Staff Name", "Rostered Hours", "Actual Hours", "Variance Hours", "Variance %"],
      data.rows.map(r => [
        r.staffName,
        r.rosteredHours.toFixed(1),
        r.actualHours.toFixed(1),
        r.varianceHours.toFixed(1),
        `${r.variancePct}%`,
      ]),
      `supersolt_rostered-vs-actual_${venueName}_${rangeLabel}.csv`
    )
  }

  if (isLoading) return <ReportSkeleton />

  return (
    <div className="space-y-6 w-full">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Rostered</p>
            <p className="text-2xl font-bold">{data.totalRostered.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Actual</p>
            <p className="text-2xl font-bold">{data.hasActual ? `${data.totalActual.toFixed(1)}h` : "—"}</p>
            {!data.hasActual && <p className="text-xs text-muted-foreground">awaiting clock-in data</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Variance</p>
            <p className={`text-2xl font-bold ${data.totalActual > data.totalRostered ? "text-red-600" : "text-green-600"}`}>
              {data.hasActual
                ? `${data.totalActual >= data.totalRostered ? "+" : ""}${(data.totalActual - data.totalRostered).toFixed(1)}h`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {!data.hasActual && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              Showing rostered hours only. Actual hours will populate once time tracking (clock-in) is live.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Rostered vs Actual by Staff</CardTitle>
            <CardDescription>Grouped bar per staff member (top 15 by rostered hours)</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No shifts in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}h`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}h`]} />
                <Legend />
                <Bar dataKey="Rostered" fill={BRAND_TEAL} />
                <Bar dataKey="Actual" fill={CHART_PURPLE} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Staff Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Name</TableHead>
                <TableHead className="text-right">Rostered</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance (h)</TableHead>
                <TableHead className="text-right">Variance %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No shifts in this period
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map(r => (
                  <TableRow key={r.staffId}>
                    <TableCell className="font-medium">{r.staffName}</TableCell>
                    <TableCell className="text-right">{r.rosteredHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{r.actualHours > 0 ? `${r.actualHours.toFixed(1)}h` : "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.actualHours > 0 ? (
                        <span className={Math.abs(r.varianceHours) <= 1 ? "text-green-600" : Math.abs(r.varianceHours) <= 3 ? "text-amber-600" : "text-red-600"}>
                          {r.varianceHours >= 0 ? "+" : ""}{r.varianceHours.toFixed(1)}h
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.actualHours > 0 ? (
                        <span className={Math.abs(r.variancePct) <= 5 ? "text-green-600" : "text-amber-600"}>
                          {r.variancePct >= 0 ? "+" : ""}{r.variancePct}%
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// REPORT: OVERTIME
// ============================================================

function OvertimeReport({
  venueId,
  dateRange,
  venueName,
  rangeLabel,
}: {
  venueId: string
  dateRange: { from: Date; to: Date }
  venueName: string
  rangeLabel: string
}) {
  const { data, isLoading } = useOvertimeReport(venueId, dateRange)

  const chartData = data.rows.map(r => ({
    name: r.staffName.split(" ")[0],
    "Regular": r.regularHours,
    "Overtime": r.otHours,
  }))

  const handleExport = () => {
    downloadCSV(
      ["Staff Name", "Regular Hours", "OT Hours", "OT Cost ($)", "OT Trigger"],
      data.rows.map(r => [
        r.staffName,
        r.regularHours.toFixed(1),
        r.otHours.toFixed(1),
        (r.otCost / 100).toFixed(2),
        r.otTrigger,
      ]),
      `supersolt_overtime_${venueName}_${rangeLabel}.csv`
    )
  }

  if (isLoading) return <ReportSkeleton />

  return (
    <div className="space-y-6 w-full">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Staff with OT</p>
            <p className="text-2xl font-bold">{data.rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total OT Hours</p>
            <p className="text-2xl font-bold text-orange-600">{data.totalOtHours.toFixed(1)}h</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Est. OT Cost</p>
            <p className="text-2xl font-bold text-orange-600">{formatLabourCost(data.totalOtCost)}</p>
            <p className="text-xs text-muted-foreground">above threshold</p>
          </CardContent>
        </Card>
      </div>

      {data.rows.length === 0 && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-4">
            <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              No staff exceeded 38h/week in this period. Great roster management!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Overtime by Staff</CardTitle>
              <CardDescription>Regular hours (≤38h/week) vs overtime hours</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}h`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}h`]} />
                <Legend />
                <Bar dataKey="Regular" stackId="a" fill={BRAND_TEAL} />
                <Bar dataKey="Overtime" stackId="a" fill={CHART_ORANGE} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Overtime Detail</CardTitle>
          {data.rows.length > 0 && chartData.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Name</TableHead>
                <TableHead className="text-right">Regular Hours</TableHead>
                <TableHead className="text-right">OT Hours</TableHead>
                <TableHead className="text-right">Est. OT Cost</TableHead>
                <TableHead>OT Trigger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No overtime in this period
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map(r => (
                  <TableRow key={r.staffId}>
                    <TableCell className="font-medium">{r.staffName}</TableCell>
                    <TableCell className="text-right">{r.regularHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">
                      <span className="text-orange-600 font-semibold">{r.otHours.toFixed(1)}h</span>
                    </TableCell>
                    <TableCell className="text-right text-orange-600">{formatLabourCost(r.otCost)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                        {r.otTrigger}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function LabourReports() {
  const { currentVenue, venues } = useAuth()

  const [selectedReport, setSelectedReport] = useState<ReportType>("labour-cost")
  const [preset, setPreset] = useState<DatePreset>("last-week")
  const [selectedVenueId, setSelectedVenueId] = useState<string>(currentVenue?.id ?? "")

  const dateRange = useMemo(() => getDateRange(preset), [preset])
  const rangeLabel = useMemo(
    () => `${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}`,
    [dateRange]
  )
  const venueName = useMemo(
    () => (venues.find(v => v.id === selectedVenueId)?.name ?? "venue").replace(/\s+/g, "-").toLowerCase(),
    [venues, selectedVenueId]
  )

  const presetOptions: { value: DatePreset; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "this-week", label: "This week" },
    { value: "last-week", label: "Last week" },
    { value: "this-month", label: "This month" },
    { value: "last-month", label: "Last month" },
  ]

  const toolbar = (
    <PageToolbar
      title="Labour"
      filters={
        <div className="flex items-center gap-2 flex-wrap">
          {venues.length > 1 && (
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger className="h-9 w-[150px] border-border/60">
                <SelectValue placeholder="Venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={preset} onValueChange={v => setPreset(v as DatePreset)}>
            <SelectTrigger className="h-9 w-[150px] border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presetOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {formatDateLabel(dateRange.from, dateRange.to)}
          </span>
        </div>
      }
    />
  )

  const reportProps = {
    venueId: selectedVenueId,
    dateRange,
    venueName,
    rangeLabel,
  }

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 py-6 space-y-6">

        {/* Report selector tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {REPORTS.map(report => {
            const Icon = report.icon
            const isActive = selectedReport === report.id
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`
                  text-left p-4 rounded-lg border transition-all duration-150 cursor-pointer
                  ${isActive
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30 shadow-sm"
                    : "border-border bg-card hover:border-teal-300 hover:bg-teal-50/40 dark:hover:bg-teal-950/10"
                  }
                `}
              >
                <Icon className={`h-5 w-5 mb-2 ${isActive ? "text-teal-600" : report.color}`} />
                <p className={`text-sm font-semibold leading-tight ${isActive ? "text-teal-700 dark:text-teal-400" : ""}`}>
                  {report.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-2">
                  {report.description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Active report */}
        {!selectedVenueId ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a venue to view reports.
            </CardContent>
          </Card>
        ) : (
          <div className="w-full space-y-6">
            {selectedReport === "labour-cost" && <LabourCostReport {...reportProps} />}
            {selectedReport === "labour-percent" && <LabourPercentReport {...reportProps} />}
            {selectedReport === "rostered-vs-actual" && <RosteredVsActualReport {...reportProps} />}
            {selectedReport === "overtime" && <OvertimeReport {...reportProps} />}
          </div>
        )}

      </div>
    </PageShell>
  )
}
