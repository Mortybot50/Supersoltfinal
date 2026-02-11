import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Users,
  AlertTriangle,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  PieChart,
} from "lucide-react"
import { useDataStore } from "@/lib/store/dataStore"
import {
  getWeekStart,
  getShiftsForWeek,
  calculateWeeklyRosterMetrics,
  detectOvertimeWarnings,
  formatLabourCost,
  formatHours,
} from "@/lib/utils/rosterCalculations"
import { format, addDays, subWeeks, startOfMonth, endOfMonth, eachWeekOfInterval, isSameWeek } from "date-fns"
import { useNavigate } from "react-router-dom"
import { PageShell, PageToolbar, PageSidebar } from "@/components/shared"

type ReportPeriod = "week" | "month" | "quarter"

export default function LabourReports() {
  const navigate = useNavigate()
  const { staff, rosterShifts, timesheets, laborBudgets } = useDataStore()

  const [period, setPeriod] = useState<ReportPeriod>("week")
  const [currentDate, setCurrentDate] = useState(new Date())

  const activeStaff = staff.filter((s) => s.status === "active")

  // Get current period dates
  const periodDates = useMemo(() => {
    if (period === "week") {
      const start = getWeekStart(currentDate)
      return { start, end: addDays(start, 6) }
    } else if (period === "month") {
      return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
    } else {
      // Quarter
      const quarterStart = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3, 1)
      const quarterEnd = new Date(currentDate.getFullYear(), Math.floor(currentDate.getMonth() / 3) * 3 + 3, 0)
      return { start: quarterStart, end: quarterEnd }
    }
  }, [currentDate, period])

  // Get shifts for period
  const periodShifts = useMemo(() => {
    return rosterShifts.filter((s) => {
      const shiftDate = new Date(s.date)
      return shiftDate >= periodDates.start && shiftDate <= periodDates.end && s.status !== "cancelled"
    })
  }, [rosterShifts, periodDates])

  // Calculate overall metrics
  const metrics = useMemo(() => {
    const totalHours = periodShifts.reduce((sum, s) => sum + s.total_hours, 0)
    const totalCost = periodShifts.reduce((sum, s) => sum + s.total_cost, 0)
    const baseCost = periodShifts.reduce((sum, s) => sum + (s.base_cost || 0), 0)
    const penaltyCost = periodShifts.reduce((sum, s) => sum + (s.penalty_cost || 0), 0)
    const avgHourlyRate = totalHours > 0 ? totalCost / totalHours / 100 : 0
    const staffCount = new Set(periodShifts.map((s) => s.staff_id)).size

    return { totalHours, totalCost, baseCost, penaltyCost, avgHourlyRate, staffCount, shiftCount: periodShifts.length }
  }, [periodShifts])

  // Get approved timesheets for period
  const approvedTimesheets = useMemo(() => {
    return timesheets.filter((t) => {
      const date = new Date(t.date)
      return date >= periodDates.start && date <= periodDates.end && t.status === "approved"
    })
  }, [timesheets, periodDates])

  const timesheetMetrics = useMemo(() => {
    const totalHours = approvedTimesheets.reduce((sum, t) => sum + t.total_hours, 0)
    const totalPay = approvedTimesheets.reduce((sum, t) => sum + t.gross_pay, 0)
    return { totalHours, totalPay }
  }, [approvedTimesheets])

  // Staff breakdown
  const staffBreakdown = useMemo(() => {
    const breakdown = activeStaff.map((s) => {
      const staffShifts = periodShifts.filter((shift) => shift.staff_id === s.id)
      const hours = staffShifts.reduce((sum, shift) => sum + shift.total_hours, 0)
      const cost = staffShifts.reduce((sum, shift) => sum + shift.total_cost, 0)
      const penaltyCost = staffShifts.reduce((sum, shift) => sum + (shift.penalty_cost || 0), 0)
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        shiftCount: staffShifts.length,
        hours,
        cost,
        penaltyCost,
        avgRate: hours > 0 ? cost / hours / 100 : 0,
      }
    }).filter((s) => s.shiftCount > 0)
      .sort((a, b) => b.hours - a.hours)

    return breakdown
  }, [activeStaff, periodShifts])

  // Day breakdown
  const dayBreakdown = useMemo(() => {
    const days: Record<string, { date: Date; hours: number; cost: number; shifts: number }> = {}

    periodShifts.forEach((shift) => {
      const dateKey = new Date(shift.date).toISOString().split("T")[0]
      if (!days[dateKey]) {
        days[dateKey] = { date: new Date(shift.date), hours: 0, cost: 0, shifts: 0 }
      }
      days[dateKey].hours += shift.total_hours
      days[dateKey].cost += shift.total_cost
      days[dateKey].shifts += 1
    })

    return Object.values(days).sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [periodShifts])

  // Weekly trend (for month/quarter view)
  const weeklyTrend = useMemo(() => {
    if (period === "week") return []

    const weeks = eachWeekOfInterval({ start: periodDates.start, end: periodDates.end }, { weekStartsOn: 1 })

    return weeks.map((weekStart) => {
      const weekShifts = periodShifts.filter((s) => isSameWeek(new Date(s.date), weekStart, { weekStartsOn: 1 }))
      const hours = weekShifts.reduce((sum, s) => sum + s.total_hours, 0)
      const cost = weekShifts.reduce((sum, s) => sum + s.total_cost, 0)
      return { weekStart, hours, cost, shiftCount: weekShifts.length }
    })
  }, [period, periodDates, periodShifts])

  // Penalty rate breakdown — all types
  const penaltyBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; hours: number; cost: number }> = {
      none: { count: 0, hours: 0, cost: 0 },
      evening: { count: 0, hours: 0, cost: 0 },
      late_night: { count: 0, hours: 0, cost: 0 },
      early_morning: { count: 0, hours: 0, cost: 0 },
      saturday: { count: 0, hours: 0, cost: 0 },
      sunday: { count: 0, hours: 0, cost: 0 },
      public_holiday: { count: 0, hours: 0, cost: 0 },
    }

    periodShifts.forEach((s) => {
      const type = s.penalty_type || "none"
      if (!breakdown[type]) {
        breakdown[type] = { count: 0, hours: 0, cost: 0 }
      }
      breakdown[type].count += 1
      breakdown[type].hours += s.total_hours
      breakdown[type].cost += s.penalty_cost || 0
    })

    return breakdown
  }, [periodShifts])

  // Rostered vs actual overtime per staff
  const overtimeComparison = useMemo(() => {
    return activeStaff.map((s) => {
      // Rostered hours
      const staffShifts = periodShifts.filter((shift) => shift.staff_id === s.id)
      const rosteredHours = staffShifts.reduce((sum, shift) => sum + shift.total_hours, 0)
      const rosteredCost = staffShifts.reduce((sum, shift) => sum + shift.total_cost, 0)

      // Actual hours (approved timesheets)
      const staffTimesheets = approvedTimesheets.filter((t) => t.staff_id === s.id)
      const actualHours = staffTimesheets.reduce((sum, t) => sum + t.total_hours, 0)
      const actualPay = staffTimesheets.reduce((sum, t) => sum + t.gross_pay, 0)

      const variance = actualHours - rosteredHours
      const overtimeRostered = Math.max(0, rosteredHours - 38)
      const overtimeActual = Math.max(0, actualHours - 38)

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        rosteredHours,
        actualHours,
        variance,
        rosteredCost,
        actualPay,
        overtimeRostered,
        overtimeActual,
        overtimeVariance: overtimeActual - overtimeRostered,
      }
    })
      .filter((s) => s.rosteredHours > 0 || s.actualHours > 0)
      .sort((a, b) => b.variance - a.variance)
  }, [activeStaff, periodShifts, approvedTimesheets])

  // Navigation
  const goToPrevious = () => {
    if (period === "week") {
      setCurrentDate((d) => addDays(d, -7))
    } else if (period === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 3, 1))
    }
  }

  const goToNext = () => {
    if (period === "week") {
      setCurrentDate((d) => addDays(d, 7))
    } else if (period === "month") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 3, 1))
    }
  }

  const exportToCSV = () => {
    const headers = ["Staff Name", "Role", "Shifts", "Hours", "Base Cost", "Penalty Cost", "Total Cost", "Avg Rate"]
    const rows = staffBreakdown.map((s) => [
      s.name,
      s.role,
      s.shiftCount,
      s.hours.toFixed(2),
      (s.cost - s.penaltyCost) / 100,
      s.penaltyCost / 100,
      s.cost / 100,
      s.avgRate.toFixed(2),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `labour-report-${format(periodDates.start, "yyyy-MM-dd")}.csv`
    a.click()
  }

  const sidebar = (
    <PageSidebar
      title="Reports"
      metrics={[
        { label: "Total Hours", value: formatHours(metrics.totalHours) },
        { label: "Total Cost", value: formatLabourCost(metrics.totalCost) },
        { label: "Staff", value: metrics.staffCount },
      ]}
      extendedMetrics={[
        { label: "Penalty Cost", value: formatLabourCost(metrics.penaltyCost), color: metrics.penaltyCost > 0 ? "orange" : "default" },
        { label: "Avg Rate", value: `$${metrics.avgHourlyRate.toFixed(2)}/hr` },
      ]}
      quickActions={[
        { label: "View Roster", icon: Calendar, onClick: () => navigate("/workforce/roster") },
        { label: "Timesheets", icon: Clock, onClick: () => navigate("/workforce/timesheets") },
        { label: "People", icon: Users, onClick: () => navigate("/workforce/people") },
      ]}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Labour Reports"
      filters={
        <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="quarter">Quarterly</SelectItem>
          </SelectContent>
        </Select>
      }
      dateNavigation={{
        label: `${format(periodDates.start, "d MMM")} - ${format(periodDates.end, "d MMM yyyy")}`,
        onBack: goToPrevious,
        onForward: goToNext,
      }}
      primaryAction={{
        label: "Export CSV",
        icon: Download,
        onClick: exportToCSV,
        variant: "export",
      }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-4 space-y-4">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(metrics.totalHours)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.shiftCount} shifts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Labor Cost
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLabourCost(metrics.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              ${metrics.avgHourlyRate.toFixed(2)}/hr avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Penalty Costs
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatLabourCost(metrics.penaltyCost)}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalCost > 0 ? ((metrics.penaltyCost / metrics.totalCost) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Staff Rostered
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.staffCount}</div>
            <p className="text-xs text-muted-foreground">
              of {activeStaff.length} active staff
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="staff">
            <Users className="h-4 w-4 mr-2" />
            By Staff
          </TabsTrigger>
          <TabsTrigger value="penalties">
            <DollarSign className="h-4 w-4 mr-2" />
            Penalty Rates
          </TabsTrigger>
          <TabsTrigger value="timesheets">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Timesheets
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Breakdown</CardTitle>
                <CardDescription>Hours and cost by day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dayBreakdown.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No shifts in this period</p>
                  ) : (
                    dayBreakdown.map((day) => (
                      <div key={day.date.toISOString()} className="flex items-center gap-4">
                        <div className="w-20 text-sm font-medium">
                          {format(day.date, "EEE d")}
                        </div>
                        <div className="flex-1">
                          <Progress value={(day.hours / Math.max(...dayBreakdown.map(d => d.hours))) * 100} className="h-2" />
                        </div>
                        <div className="w-16 text-right text-sm">{day.hours.toFixed(1)}h</div>
                        <div className="w-20 text-right text-sm text-muted-foreground">
                          {formatLabourCost(day.cost)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Weekly Trend (if month/quarter) */}
            {period !== "week" && (
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Trend</CardTitle>
                  <CardDescription>Cost trend over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {weeklyTrend.map((week, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-24 text-sm font-medium">
                          Week {format(week.weekStart, "d MMM")}
                        </div>
                        <div className="flex-1">
                          <Progress
                            value={weeklyTrend.length > 0 ? (week.cost / Math.max(...weeklyTrend.map(w => w.cost))) * 100 : 0}
                            className="h-2"
                          />
                        </div>
                        <div className="w-20 text-right text-sm">
                          {formatLabourCost(week.cost)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cost Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>Base vs penalty costs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Base Pay</span>
                      <span className="font-medium">{formatLabourCost(metrics.baseCost)}</span>
                    </div>
                    <Progress value={metrics.totalCost > 0 ? (metrics.baseCost / metrics.totalCost) * 100 : 0} className="h-3 bg-blue-100" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Penalty Loading</span>
                      <span className="font-medium text-orange-600">{formatLabourCost(metrics.penaltyCost)}</span>
                    </div>
                    <Progress value={metrics.totalCost > 0 ? (metrics.penaltyCost / metrics.totalCost) * 100 : 0} className="h-3 bg-orange-100" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Hours and costs by staff member</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Shifts</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Base Cost</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Avg Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No shifts in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    staffBreakdown.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium cursor-pointer hover:text-teal-600 transition-colors" onClick={() => navigate(`/workforce/people/${s.id}`)}>{s.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{s.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{s.shiftCount}</TableCell>
                        <TableCell className="text-right">{s.hours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right">{formatLabourCost(s.cost - s.penaltyCost)}</TableCell>
                        <TableCell className="text-right text-orange-600">
                          {s.penaltyCost > 0 ? formatLabourCost(s.penaltyCost) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatLabourCost(s.cost)}</TableCell>
                        <TableCell className="text-right">${s.avgRate.toFixed(2)}/hr</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Penalty Rates Tab */}
        <TabsContent value="penalties">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Penalty Rate Breakdown</CardTitle>
                <CardDescription>Costs by penalty type (AU Hospitality Award)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="font-medium">Regular Hours</div>
                      <div className="text-sm text-muted-foreground">{penaltyBreakdown.none.count} shifts · {penaltyBreakdown.none.hours.toFixed(1)}h</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatLabourCost(metrics.baseCost)}</div>
                      <div className="text-xs text-muted-foreground">100% base</div>
                    </div>
                  </div>

                  {penaltyBreakdown.evening.count > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div>
                        <div className="font-medium text-blue-700 dark:text-blue-400">Evening (7pm-12am)</div>
                        <div className="text-sm text-muted-foreground">{penaltyBreakdown.evening.count} shifts · {penaltyBreakdown.evening.hours.toFixed(1)}h</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-blue-600">+{formatLabourCost(penaltyBreakdown.evening.cost)}</div>
                        <div className="text-xs text-blue-600">115% loading</div>
                      </div>
                    </div>
                  )}

                  {penaltyBreakdown.late_night.count > 0 && (
                    <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                      <div>
                        <div className="font-medium text-indigo-700 dark:text-indigo-400">Late Night (12am-6am)</div>
                        <div className="text-sm text-muted-foreground">{penaltyBreakdown.late_night.count} shifts · {penaltyBreakdown.late_night.hours.toFixed(1)}h</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-indigo-600">+{formatLabourCost(penaltyBreakdown.late_night.cost)}</div>
                        <div className="text-xs text-indigo-600">125% loading</div>
                      </div>
                    </div>
                  )}

                  {penaltyBreakdown.early_morning.count > 0 && (
                    <div className="flex items-center justify-between p-3 bg-sky-50 dark:bg-sky-950/30 rounded-lg">
                      <div>
                        <div className="font-medium text-sky-700 dark:text-sky-400">Early Morning (before 7am)</div>
                        <div className="text-sm text-muted-foreground">{penaltyBreakdown.early_morning.count} shifts · {penaltyBreakdown.early_morning.hours.toFixed(1)}h</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sky-600">+{formatLabourCost(penaltyBreakdown.early_morning.cost)}</div>
                        <div className="text-xs text-sky-600">115% loading</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                    <div>
                      <div className="font-medium text-orange-700 dark:text-orange-400">Saturday</div>
                      <div className="text-sm text-muted-foreground">{penaltyBreakdown.saturday.count} shifts · {penaltyBreakdown.saturday.hours.toFixed(1)}h</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-orange-600">+{formatLabourCost(penaltyBreakdown.saturday.cost)}</div>
                      <div className="text-xs text-orange-600">125% loading</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <div>
                      <div className="font-medium text-orange-800 dark:text-orange-300">Sunday</div>
                      <div className="text-sm text-muted-foreground">{penaltyBreakdown.sunday.count} shifts · {penaltyBreakdown.sunday.hours.toFixed(1)}h</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-orange-700">+{formatLabourCost(penaltyBreakdown.sunday.cost)}</div>
                      <div className="text-xs text-orange-700">150% loading</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <div>
                      <div className="font-medium text-purple-800 dark:text-purple-300">Public Holiday</div>
                      <div className="text-sm text-muted-foreground">{penaltyBreakdown.public_holiday.count} shifts · {penaltyBreakdown.public_holiday.hours.toFixed(1)}h</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-purple-700">+{formatLabourCost(penaltyBreakdown.public_holiday.cost)}</div>
                      <div className="text-xs text-purple-700">250% loading</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Penalty Cost Summary</CardTitle>
                <CardDescription>Total additional costs from penalty rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <div className="text-4xl font-bold text-orange-600">{formatLabourCost(metrics.penaltyCost)}</div>
                  <p className="text-muted-foreground mt-2">Additional penalty loading</p>
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <div className="text-sm">
                      <span className="text-muted-foreground">That's </span>
                      <span className="font-bold">
                        {metrics.totalCost > 0 ? ((metrics.penaltyCost / metrics.totalCost) * 100).toFixed(1) : 0}%
                      </span>
                      <span className="text-muted-foreground"> of your total labor cost</span>
                    </div>
                  </div>
                  {/* Breakdown mini-bars */}
                  {metrics.penaltyCost > 0 && (
                    <div className="mt-4 space-y-2 text-left">
                      {[
                        { key: "evening", label: "Evening", color: "bg-blue-500" },
                        { key: "late_night", label: "Late Night", color: "bg-indigo-500" },
                        { key: "early_morning", label: "Early AM", color: "bg-sky-500" },
                        { key: "saturday", label: "Saturday", color: "bg-orange-400" },
                        { key: "sunday", label: "Sunday", color: "bg-orange-500" },
                        { key: "public_holiday", label: "Public Holiday", color: "bg-purple-500" },
                      ].filter(({ key }) => penaltyBreakdown[key]?.cost > 0).map(({ key, label, color }) => (
                        <div key={key} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${color}`} />
                          <span className="text-xs flex-1">{label}</span>
                          <span className="text-xs font-medium">{formatLabourCost(penaltyBreakdown[key].cost)}</span>
                          <span className="text-[10px] text-muted-foreground w-10 text-right">
                            {((penaltyBreakdown[key].cost / metrics.penaltyCost) * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Timesheets Tab */}
        <TabsContent value="timesheets">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approved Hours
                </CardTitle>
                <Clock className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{timesheetMetrics.totalHours.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground">
                  {approvedTimesheets.length} approved entries
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approved Pay
                </CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatLabourCost(timesheetMetrics.totalPay)}</div>
                <p className="text-xs text-muted-foreground">
                  Ready for payroll
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Variance
                </CardTitle>
                {timesheetMetrics.totalHours > metrics.totalHours ? (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-green-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  timesheetMetrics.totalHours > metrics.totalHours ? "text-red-600" : "text-green-600"
                }`}>
                  {(timesheetMetrics.totalHours - metrics.totalHours).toFixed(1)}h
                </div>
                <p className="text-xs text-muted-foreground">
                  vs rostered hours
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Rostered vs Actual</CardTitle>
              <CardDescription>Compare scheduled hours with actual timesheets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Rostered Hours</span>
                    <span className="font-medium">{metrics.totalHours.toFixed(1)}h</span>
                  </div>
                  <Progress value={100} className="h-3 bg-blue-100" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Actual Hours (Approved Timesheets)</span>
                    <span className="font-medium">{timesheetMetrics.totalHours.toFixed(1)}h</span>
                  </div>
                  <Progress
                    value={metrics.totalHours > 0 ? (timesheetMetrics.totalHours / metrics.totalHours) * 100 : 0}
                    className="h-3 bg-green-100"
                  />
                </div>
              </div>

              {/* Per-staff rostered vs actual with overtime */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Rostered</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">OT Rostered</TableHead>
                    <TableHead className="text-right">OT Actual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overtimeComparison.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        No data for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    overtimeComparison.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium cursor-pointer hover:text-teal-600" onClick={() => navigate(`/workforce/people/${s.id}`)}>
                          {s.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{s.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{s.rosteredHours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right">{s.actualHours.toFixed(1)}h</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-xs font-medium ${
                            Math.abs(s.variance) <= 1 ? "text-green-600" : Math.abs(s.variance) <= 3 ? "text-orange-600" : "text-red-600"
                          }`}>
                            {s.variance >= 0 ? "+" : ""}{s.variance.toFixed(1)}h
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {s.overtimeRostered > 0 ? (
                            <span className="text-orange-600 text-xs font-medium">{s.overtimeRostered.toFixed(1)}h</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.overtimeActual > 0 ? (
                            <span className={`text-xs font-medium ${
                              s.overtimeActual > s.overtimeRostered ? "text-red-600" : "text-orange-600"
                            }`}>
                              {s.overtimeActual.toFixed(1)}h
                              {s.overtimeVariance > 0 && (
                                <span className="text-red-500 ml-1">(+{s.overtimeVariance.toFixed(1)})</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  )
}
