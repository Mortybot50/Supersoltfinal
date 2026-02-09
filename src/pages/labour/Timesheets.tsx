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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Clock, DollarSign, CheckCircle, XCircle, MoreVertical, Check, X, FileCheck, Calendar } from "lucide-react"
import { useDataStore } from "@/lib/store/dataStore"
import { useRosterMetrics } from "@/lib/hooks/useRosterMetrics"
import { Timesheet } from "@/types"
import { format, startOfWeek, endOfWeek, addDays, isWithinInterval, parseISO } from "date-fns"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { PageShell, PageToolbar, PageSidebar, StatusBadge } from "@/components/shared"

type StatusFilter = "all" | "pending" | "approved" | "rejected"

export default function Timesheets() {
  const navigate = useNavigate()
  const { timesheets, rosterShifts, approveTimesheet, rejectTimesheet, updateTimesheet } = useDataStore()
  const rosterMetrics = useRosterMetrics()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart])

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter((ts) => {
      if (statusFilter !== "all" && ts.status !== statusFilter) return false
      const tsDate = new Date(ts.date)
      return isWithinInterval(tsDate, { start: weekStart, end: weekEnd })
    })
  }, [timesheets, statusFilter, weekStart, weekEnd])

  const metrics = useMemo(() => {
    const pending = filteredTimesheets.filter((ts) => ts.status === "pending")
    const approved = filteredTimesheets.filter((ts) => ts.status === "approved")
    const totalHours = filteredTimesheets.reduce((sum, ts) => sum + ts.total_hours, 0)
    const totalPay = approved.reduce((sum, ts) => sum + ts.gross_pay, 0)
    return { totalCount: filteredTimesheets.length, pendingCount: pending.length, approvedCount: approved.length, totalHours, totalPay }
  }, [filteredTimesheets])

  const handleApprove = (id: string) => { approveTimesheet(id); toast.success("Timesheet approved") }
  const handleReject = (id: string) => { rejectTimesheet(id); toast.success("Timesheet rejected") }
  const handleBulkApprove = () => {
    const pending = filteredTimesheets.filter((ts) => ts.status === "pending")
    pending.forEach((ts) => approveTimesheet(ts.id))
    toast.success(`${pending.length} timesheets approved`)
  }

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return "—"
    const d = typeof date === "string" ? new Date(date) : date
    return format(d, "h:mm a")
  }

  // Find rostered shift for a timesheet entry
  const getRosteredShift = (ts: Timesheet) => {
    const tsDateStr = new Date(ts.date).toISOString().split("T")[0]
    return rosterShifts.find((s) => {
      const shiftDate = new Date(s.date).toISOString().split("T")[0]
      return s.staff_id === ts.staff_id && shiftDate === tsDateStr && s.status !== "cancelled"
    })
  }

  const sidebar = (
    <PageSidebar
      title="Timesheets"
      metrics={[
        { label: "Total Hours", value: `${metrics.totalHours.toFixed(1)}h` },
        { label: "Total Pay", value: `$${(metrics.totalPay / 100).toFixed(2)}` },
        { label: "Entries", value: metrics.totalCount },
      ]}
      extendedMetrics={[
        { label: "Pending", value: metrics.pendingCount, color: metrics.pendingCount > 0 ? "orange" : "default" },
        { label: "Approved", value: metrics.approvedCount, color: "green" },
      ]}
      quickActions={[
        { label: "View Roster", icon: Calendar, onClick: () => navigate("/workforce/roster") },
      ]}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Timesheets"
      dateNavigation={{
        label: `${format(weekStart, "d MMM")} - ${format(weekEnd, "d MMM")}`,
        onBack: () => setWeekStart((prev) => addDays(prev, -7)),
        onForward: () => setWeekStart((prev) => addDays(prev, 7)),
      }}
      filters={
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      }
      primaryAction={
        metrics.pendingCount > 0
          ? {
              label: `Approve All (${metrics.pendingCount})`,
              icon: FileCheck,
              onClick: handleBulkApprove,
              variant: "teal",
            }
          : undefined
      }
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      {/* Roster Published Banner */}
      {rosterMetrics.confirmedShiftCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 border-b px-4 py-2 flex items-center gap-3">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            Roster published: {rosterMetrics.confirmedShiftCount} confirmed shifts this week
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-700" onClick={() => navigate("/workforce/roster")}>
            View Roster
          </Button>
        </div>
      )}

      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Break</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Variance</TableHead>
              <TableHead className="text-right">Pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTimesheets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground h-32">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No timesheet entries found</p>
                  <p className="text-sm mt-1">
                    {timesheets.length === 0
                      ? "Time entries will appear when staff clock in"
                      : "Adjust filters to see more entries"}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTimesheets.map((ts) => {
                const rosteredShift = getRosteredShift(ts)
                const variance = rosteredShift
                  ? ts.total_hours - rosteredShift.total_hours
                  : null

                return (
                  <TableRow key={ts.id}>
                    <TableCell className="font-medium">{ts.staff_name}</TableCell>
                    <TableCell>{format(new Date(ts.date), "EEE, MMM d")}</TableCell>
                    <TableCell>{formatTime(ts.clock_in)}</TableCell>
                    <TableCell>{formatTime(ts.clock_out)}</TableCell>
                    <TableCell>{ts.break_minutes}m</TableCell>
                    <TableCell className="text-right">{ts.total_hours.toFixed(2)}h</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rosteredShift
                        ? `${rosteredShift.start_time}-${rosteredShift.end_time}`
                        : "No shift"}
                    </TableCell>
                    <TableCell>
                      {variance !== null ? (
                        <span
                          className={`text-xs font-medium ${
                            Math.abs(variance) <= 0.5
                              ? "text-green-600"
                              : Math.abs(variance) <= 1
                              ? "text-orange-600"
                              : "text-red-600"
                          }`}
                        >
                          {variance >= 0 ? "+" : ""}
                          {variance.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">${(ts.gross_pay / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <StatusBadge status={ts.status} size="sm" />
                    </TableCell>
                    <TableCell>
                      {ts.status === "pending" ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApprove(ts.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleReject(ts.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {ts.status !== "approved" && (
                              <DropdownMenuItem onClick={() => handleApprove(ts.id)}>
                                <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Approve
                              </DropdownMenuItem>
                            )}
                            {ts.status !== "rejected" && (
                              <DropdownMenuItem onClick={() => handleReject(ts.id)}>
                                <XCircle className="h-4 w-4 mr-2 text-red-600" /> Reject
                              </DropdownMenuItem>
                            )}
                            {ts.status !== "pending" && (
                              <DropdownMenuItem onClick={() => updateTimesheet(ts.id, { status: "pending" })}>
                                <Clock className="h-4 w-4 mr-2" /> Reset to Pending
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  )
}
