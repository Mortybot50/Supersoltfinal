import { useState, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, DollarSign, Clock, Users, Calendar, FileSpreadsheet } from "lucide-react"
import { useDataStore } from "@/lib/store/dataStore"
import { useRosterMetrics } from "@/lib/hooks/useRosterMetrics"
import { format, startOfWeek, endOfWeek, addDays, subWeeks, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { PageShell, PageToolbar, PageSidebar, StatusBadge } from "@/components/shared"
import { formatLabourCost } from "@/lib/utils/rosterCalculations"

type PayrollPeriod = "this-week" | "last-week" | "this-fortnight" | "this-month"
type ExportFormat = "xero" | "keypay" | "myob" | "csv"

export default function Payroll() {
  const navigate = useNavigate()
  const { staff, timesheets, rosterShifts } = useDataStore()
  const rosterMetrics = useRosterMetrics()

  const [period, setPeriod] = useState<PayrollPeriod>("this-week")
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv")

  const dateRange = useMemo(() => {
    const now = new Date()
    switch (period) {
      case "this-week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
      case "last-week": {
        const lastWeek = subWeeks(now, 1)
        return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) }
      }
      case "this-fortnight": {
        const twoWeeksAgo = subWeeks(now, 1)
        return { start: startOfWeek(twoWeeksAgo, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
      }
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) }
    }
  }, [period])

  const approvedTimesheets = useMemo(() => {
    return timesheets.filter((ts) => {
      if (ts.status !== "approved") return false
      const tsDate = new Date(ts.date)
      return isWithinInterval(tsDate, { start: dateRange.start, end: dateRange.end })
    })
  }, [timesheets, dateRange])

  const staffBreakdown = useMemo(() => {
    const activeStaff = staff.filter((s) => s.status === "active")
    return activeStaff.map((s) => {
      const staffTimesheets = approvedTimesheets.filter((ts) => ts.staff_id === s.id)
      const actualHours = staffTimesheets.reduce((sum, ts) => sum + ts.total_hours, 0)
      const grossPay = staffTimesheets.reduce((sum, ts) => sum + ts.gross_pay, 0)

      // Get rostered hours for period
      const rosteredShifts = rosterShifts.filter((shift) => {
        const shiftDate = new Date(shift.date)
        return shift.staff_id === s.id &&
          isWithinInterval(shiftDate, { start: dateRange.start, end: dateRange.end }) &&
          shift.status !== "cancelled"
      })
      const rosteredHours = rosteredShifts.reduce((sum, shift) => sum + shift.total_hours, 0)

      const superAmount = Math.round(grossPay * 0.115) // 11.5% super
      const variance = actualHours - rosteredHours

      return {
        id: s.id,
        name: s.name,
        role: s.role,
        hourlyRate: s.hourly_rate,
        rosteredHours,
        actualHours,
        variance,
        grossPay,
        superAmount,
        total: grossPay + superAmount,
        entryCount: staffTimesheets.length,
      }
    }).filter((s) => s.entryCount > 0 || s.rosteredHours > 0)
      .sort((a, b) => b.actualHours - a.actualHours)
  }, [staff, approvedTimesheets, rosterShifts, dateRange])

  const totals = useMemo(() => {
    return {
      rosteredHours: staffBreakdown.reduce((sum, s) => sum + s.rosteredHours, 0),
      actualHours: staffBreakdown.reduce((sum, s) => sum + s.actualHours, 0),
      grossPay: staffBreakdown.reduce((sum, s) => sum + s.grossPay, 0),
      superAmount: staffBreakdown.reduce((sum, s) => sum + s.superAmount, 0),
      total: staffBreakdown.reduce((sum, s) => sum + s.total, 0),
      staffCount: staffBreakdown.length,
    }
  }, [staffBreakdown])

  const pendingCount = useMemo(() => {
    return timesheets.filter((ts) => {
      if (ts.status !== "pending") return false
      const tsDate = new Date(ts.date)
      return isWithinInterval(tsDate, { start: dateRange.start, end: dateRange.end })
    }).length
  }, [timesheets, dateRange])

  const handleExport = () => {
    if (staffBreakdown.length === 0) {
      toast.error("No approved timesheets to export")
      return
    }

    let csvContent: string
    const periodLabel = `${format(dateRange.start, "yyyy-MM-dd")}_${format(dateRange.end, "yyyy-MM-dd")}`

    switch (exportFormat) {
      case "xero":
        csvContent = [
          "Employee Name,Pay Period Start,Pay Period End,Ordinary Hours,Gross Pay,Superannuation",
          ...staffBreakdown.map((s) =>
            `"${s.name}",${format(dateRange.start, "yyyy-MM-dd")},${format(dateRange.end, "yyyy-MM-dd")},${s.actualHours.toFixed(2)},${(s.grossPay / 100).toFixed(2)},${(s.superAmount / 100).toFixed(2)}`
          ),
        ].join("\n")
        break
      case "keypay":
        csvContent = [
          "Employee,Hours,Rate,Gross,Super",
          ...staffBreakdown.map((s) =>
            `"${s.name}",${s.actualHours.toFixed(2)},${(s.hourlyRate / 100).toFixed(2)},${(s.grossPay / 100).toFixed(2)},${(s.superAmount / 100).toFixed(2)}`
          ),
        ].join("\n")
        break
      case "myob":
        csvContent = [
          "Co./Last Name,First Name,Pay Period,Hours,Gross Pay,Super Guarantee",
          ...staffBreakdown.map((s) => {
            const parts = s.name.split(" ")
            const lastName = parts.slice(-1).join(" ")
            const firstName = parts.slice(0, -1).join(" ")
            return `"${lastName}","${firstName}","${format(dateRange.start, "dd/MM/yyyy")} - ${format(dateRange.end, "dd/MM/yyyy")}",${s.actualHours.toFixed(2)},${(s.grossPay / 100).toFixed(2)},${(s.superAmount / 100).toFixed(2)}`
          }),
        ].join("\n")
        break
      default:
        csvContent = [
          "Staff Name,Role,Rostered Hours,Actual Hours,Variance,Hourly Rate,Gross Pay,Super (11.5%),Total",
          ...staffBreakdown.map((s) =>
            `"${s.name}","${s.role}",${s.rosteredHours.toFixed(2)},${s.actualHours.toFixed(2)},${s.variance.toFixed(2)},${(s.hourlyRate / 100).toFixed(2)},${(s.grossPay / 100).toFixed(2)},${(s.superAmount / 100).toFixed(2)},${(s.total / 100).toFixed(2)}`
          ),
        ].join("\n")
    }

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `payroll-${exportFormat}-${periodLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${staffBreakdown.length} staff to ${exportFormat.toUpperCase()} format`)
  }

  const sidebar = (
    <PageSidebar
      title="Payroll"
      metrics={[
        { label: "Total Hours", value: `${totals.actualHours.toFixed(1)}h` },
        { label: "Gross Pay", value: formatLabourCost(totals.grossPay) },
        { label: "Staff", value: totals.staffCount },
      ]}
      extendedMetrics={[
        { label: "Super (11.5%)", value: formatLabourCost(totals.superAmount) },
        { label: "Total Cost", value: formatLabourCost(totals.total) },
      ]}
      quickActions={[
        { label: "Timesheets", icon: Clock, onClick: () => navigate("/workforce/timesheets"), badge: pendingCount || undefined },
        { label: "View Roster", icon: Calendar, onClick: () => navigate("/workforce/roster") },
        { label: "People", icon: Users, onClick: () => navigate("/workforce/people") },
      ]}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Payroll"
      filters={
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PayrollPeriod)}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="last-week">Last Week</SelectItem>
              <SelectItem value="this-fortnight">Fortnight</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {format(dateRange.start, "d MMM")} - {format(dateRange.end, "d MMM yyyy")}
          </span>
        </div>
      }
      primaryAction={{
        label: "Export",
        icon: Download,
        onClick: handleExport,
        variant: "teal",
      }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      {pendingCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border-b px-4 py-2 flex items-center gap-3">
          <Clock className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            {pendingCount} pending timesheets need approval before export
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-yellow-700" onClick={() => navigate("/workforce/timesheets")}>
            Approve Timesheets
          </Button>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">Generic CSV</SelectItem>
                <SelectItem value="xero">Xero</SelectItem>
                <SelectItem value="keypay">KeyPay</SelectItem>
                <SelectItem value="myob">MYOB</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">Export format</span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Rostered</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Gross Pay</TableHead>
              <TableHead className="text-right">Super</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffBreakdown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground h-32">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payroll data for this period</p>
                  <p className="text-sm mt-1">Approve timesheets to generate payroll</p>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {staffBreakdown.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.role as "manager" | "supervisor" | "crew"} size="sm" />
                    </TableCell>
                    <TableCell className="text-right">{s.rosteredHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{s.actualHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-medium ${
                        Math.abs(s.variance) <= 0.5
                          ? "text-green-600"
                          : Math.abs(s.variance) <= 1
                          ? "text-orange-600"
                          : "text-red-600"
                      }`}>
                        {s.variance >= 0 ? "+" : ""}{s.variance.toFixed(1)}h
                      </span>
                    </TableCell>
                    <TableCell className="text-right">${(s.hourlyRate / 100).toFixed(2)}/hr</TableCell>
                    <TableCell className="text-right">{formatLabourCost(s.grossPay)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatLabourCost(s.superAmount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatLabourCost(s.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell>Totals</TableCell>
                  <TableCell>{totals.staffCount} staff</TableCell>
                  <TableCell className="text-right">{totals.rosteredHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right">{totals.actualHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-xs font-medium ${
                      Math.abs(totals.actualHours - totals.rosteredHours) <= 2
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}>
                      {totals.actualHours - totals.rosteredHours >= 0 ? "+" : ""}{(totals.actualHours - totals.rosteredHours).toFixed(1)}h
                    </span>
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right">{formatLabourCost(totals.grossPay)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatLabourCost(totals.superAmount)}</TableCell>
                  <TableCell className="text-right font-bold">{formatLabourCost(totals.total)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  )
}
