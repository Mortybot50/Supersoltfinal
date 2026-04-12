import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  MoreVertical,
  Check,
  X,
  FileCheck,
  Calendar,
  ListPlus,
  Edit3,
  Loader2,
} from "lucide-react";
import { useDataStore } from "@/lib/store/dataStore";
import { useRosterMetrics } from "@/lib/hooks/useRosterMetrics";
import { Timesheet, RosterShift } from "@/types";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isWithinInterval,
  eachDayOfInterval,
} from "date-fns";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatters";
import { useNavigate } from "react-router-dom";
import { PageShell, PageToolbar, StatusBadge } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { SecondaryStats } from "@/components/ui/SecondaryStats";
import { calculateShiftHoursAndCost } from "@/lib/utils/rosterCalculations";
import { useAuth } from "@/contexts/AuthContext";
import {
  approveTimesheetInDB,
  rejectTimesheetInDB,
  updateTimesheetInDB,
  addTimesheetToDB,
} from "@/lib/services/labourService";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function Timesheets() {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const {
    timesheets,
    rosterShifts,
    staff,
    isLoading,
    addTimesheet,
    approveTimesheet,
    rejectTimesheet,
    updateTimesheet,
  } = useDataStore();
  const rosterMetrics = useRosterMetrics();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );

  // Adjustment dialog state
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Timesheet | null>(null);
  const [adjustHours, setAdjustHours] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const weekEnd = useMemo(
    () => endOfWeek(weekStart, { weekStartsOn: 1 }),
    [weekStart],
  );

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter((ts) => {
      if (statusFilter !== "all" && ts.status !== statusFilter) return false;
      const tsDate = new Date(ts.date);
      return isWithinInterval(tsDate, { start: weekStart, end: weekEnd });
    });
  }, [timesheets, statusFilter, weekStart, weekEnd]);

  const metrics = useMemo(() => {
    const pending = filteredTimesheets.filter((ts) => ts.status === "pending");
    const approved = filteredTimesheets.filter(
      (ts) => ts.status === "approved",
    );
    const totalHours = filteredTimesheets.reduce(
      (sum, ts) => sum + ts.total_hours,
      0,
    );
    const totalPay = approved.reduce((sum, ts) => sum + ts.gross_pay, 0);
    return {
      totalCount: filteredTimesheets.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      totalHours,
      totalPay,
    };
  }, [filteredTimesheets]);

  const handleApprove = async (id: string) => {
    const ok = await approveTimesheetInDB(id, currentOrg?.id ?? "");
    if (ok) {
      approveTimesheet(id);
      toast.success("Timesheet approved");
    }
  };
  const handleReject = async (id: string) => {
    const ok = await rejectTimesheetInDB(id);
    if (ok) {
      rejectTimesheet(id);
      toast.success("Timesheet rejected");
    }
  };
  const handleBulkApprove = async () => {
    const pending = filteredTimesheets.filter((ts) => ts.status === "pending");
    let approved = 0;
    for (const ts of pending) {
      const ok = await approveTimesheetInDB(ts.id, currentOrg?.id ?? "");
      if (ok) {
        approveTimesheet(ts.id);
        approved++;
      }
    }
    toast.success(`${approved} timesheets approved`);
  };

  const formatTime = (date: Date | string | undefined) => {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "h:mm a");
  };

  // Find rostered shift for a timesheet entry
  const getRosteredShift = (ts: Timesheet) => {
    const tsDateStr = new Date(ts.date).toISOString().split("T")[0];
    return rosterShifts.find((s) => {
      const shiftDate = new Date(s.date).toISOString().split("T")[0];
      return (
        s.staff_id === ts.staff_id &&
        shiftDate === tsDateStr &&
        s.status !== "cancelled"
      );
    });
  };

  // Generate timesheets from confirmed roster shifts
  const handleGenerateFromRoster = useCallback(async () => {
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekShifts = rosterShifts.filter((s) => {
      if (s.status === "cancelled" || s.is_open_shift) return false;
      const shiftDate = new Date(s.date);
      return isWithinInterval(shiftDate, { start: weekStart, end: weekEnd });
    });

    // Find shifts that don't already have a timesheet entry
    const existingKeys = new Set(
      timesheets.map((ts) => {
        const d = new Date(ts.date).toISOString().split("T")[0];
        return `${ts.staff_id}_${d}`;
      }),
    );

    const newShifts = weekShifts.filter((s) => {
      const d = new Date(s.date).toISOString().split("T")[0];
      return !existingKeys.has(`${s.staff_id}_${d}`);
    });

    if (newShifts.length === 0) {
      toast.info("All roster shifts already have timesheet entries");
      return;
    }

    let created = 0;
    for (const shift of newShifts) {
      const shiftDate = new Date(shift.date);
      const [startH, startM] = shift.start_time.split(":").map(Number);
      const [endH, endM] = shift.end_time.split(":").map(Number);

      const clockIn = new Date(shiftDate);
      clockIn.setHours(startH, startM, 0, 0);
      const clockOut = new Date(shiftDate);
      clockOut.setHours(endH, endM, 0, 0);
      if (endH < startH) clockOut.setDate(clockOut.getDate() + 1);

      const staffMember = staff.find((s) => s.id === shift.staff_id);
      const hourlyRate = staffMember?.hourly_rate || 0;
      const calc = calculateShiftHoursAndCost(
        shift.start_time,
        shift.end_time,
        shift.break_minutes,
        hourlyRate,
        shiftDate,
      );

      const timesheet: Timesheet = {
        id: `ts-gen-${Date.now()}-${created}`,
        venue_id: shift.venue_id,
        staff_id: shift.staff_id,
        staff_name: shift.staff_name,
        date: shiftDate,
        clock_in: clockIn,
        clock_out: clockOut,
        break_minutes: shift.break_minutes,
        total_hours: calc.hours,
        gross_pay: calc.cost,
        status: "pending",
        notes: `Generated from roster shift ${shift.start_time}-${shift.end_time}`,
      };
      const saved = await addTimesheetToDB(timesheet, currentOrg?.id ?? "");
      if (saved) {
        addTimesheet(timesheet);
        created++;
      }
    }

    toast.success(`Generated ${created} timesheet entries from roster`);
  }, [
    weekStart,
    weekEnd,
    rosterShifts,
    timesheets,
    staff,
    addTimesheet,
    currentOrg?.id,
  ]);

  // Open adjustment dialog
  const handleAdjust = (ts: Timesheet) => {
    setAdjustTarget(ts);
    setAdjustHours(ts.total_hours.toFixed(2));
    setAdjustReason("");
    setAdjustDialogOpen(true);
  };

  // Save adjustment
  const handleSaveAdjustment = async () => {
    if (!adjustTarget || !adjustReason.trim()) {
      toast.error("Please provide a reason for the adjustment");
      return;
    }
    const newHours = parseFloat(adjustHours);
    if (isNaN(newHours) || newHours < 0) {
      toast.error("Please enter valid hours");
      return;
    }

    const staffMember = staff.find((s) => s.id === adjustTarget.staff_id);
    const hourlyRate = staffMember?.hourly_rate || 0;
    const payPerHour =
      adjustTarget.total_hours > 0
        ? adjustTarget.gross_pay / adjustTarget.total_hours
        : hourlyRate;
    const newPay = Math.round(newHours * payPerHour);
    const newNotes = `${adjustTarget.notes ? adjustTarget.notes + " | " : ""}Adjusted: ${adjustReason} (was ${adjustTarget.total_hours.toFixed(2)}h)`;

    const updates = {
      total_hours: newHours,
      gross_pay: newPay,
      notes: newNotes,
    };
    const ok = await updateTimesheetInDB(adjustTarget.id, updates);
    if (ok) {
      updateTimesheet(adjustTarget.id, updates);
      toast.success(`Hours adjusted to ${newHours.toFixed(2)}h`);
      setAdjustDialogOpen(false);
      setAdjustTarget(null);
    }
  };

  // Count roster shifts this week that don't have timesheets yet
  const generatableCount = useMemo(() => {
    const existingKeys = new Set(
      timesheets.map((ts) => {
        const d = new Date(ts.date).toISOString().split("T")[0];
        return `${ts.staff_id}_${d}`;
      }),
    );
    return rosterShifts.filter((s) => {
      if (s.status === "cancelled" || s.is_open_shift) return false;
      const shiftDate = new Date(s.date);
      if (!isWithinInterval(shiftDate, { start: weekStart, end: weekEnd }))
        return false;
      const d = shiftDate.toISOString().split("T")[0];
      return !existingKeys.has(`${s.staff_id}_${d}`);
    }).length;
  }, [rosterShifts, timesheets, weekStart, weekEnd]);

  const toolbar = (
    <PageToolbar
      title="Timesheets"
      dateNavigation={{
        label: `${format(weekStart, "d MMM")} - ${format(weekEnd, "d MMM")}`,
        onBack: () => setWeekStart((prev) => addDays(prev, -7)),
        onForward: () => setWeekStart((prev) => addDays(prev, 7)),
      }}
      filters={
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-[140px] border-border/60">
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
              variant: "primary",
            }
          : undefined
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 pt-6 pb-2 space-y-4">
        <StatCards
          stats={[
            {
              label: "Total Hours",
              value: `${metrics.totalHours.toFixed(1)}h`,
            },
            { label: "Total Pay", value: formatCurrency(metrics.totalPay) },
            { label: "Entries", value: metrics.totalCount },
          ]}
          columns={3}
        />
        <SecondaryStats
          stats={[
            { label: "Pending", value: metrics.pendingCount },
            { label: "Approved", value: metrics.approvedCount },
            ...(generatableCount > 0
              ? [{ label: "Can Generate", value: generatableCount }]
              : []),
          ]}
        />
      </div>

      {/* Roster Published Banner */}
      {rosterMetrics.confirmedShiftCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 border-b px-4 py-2 flex items-center gap-3">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            Roster published: {rosterMetrics.confirmedShiftCount} confirmed
            shifts this week
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-700"
            onClick={() => navigate("/workforce/roster")}
          >
            View Roster
          </Button>
        </div>
      )}

      <div className="px-6 pb-6 overflow-x-auto">
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-800/80">
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Staff Member
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Clock In
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Clock Out
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Break
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Hours
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Scheduled
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Variance
                </TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Pay
                </TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="w-[80px] text-xs uppercase tracking-wider font-medium text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && timesheets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground h-32"
                  >
                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                    <p>Loading timesheets...</p>
                  </TableCell>
                </TableRow>
              ) : filteredTimesheets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground h-32"
                  >
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
                  const rosteredShift = getRosteredShift(ts);
                  const variance = rosteredShift
                    ? ts.total_hours - rosteredShift.total_hours
                    : null;

                  return (
                    <TableRow key={ts.id}>
                      <TableCell className="font-medium">
                        {ts.staff_name}
                      </TableCell>
                      <TableCell>
                        {format(new Date(ts.date), "EEE, MMM d")}
                      </TableCell>
                      <TableCell>{formatTime(ts.clock_in)}</TableCell>
                      <TableCell>{formatTime(ts.clock_out)}</TableCell>
                      <TableCell>{ts.break_minutes}m</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {ts.total_hours.toFixed(2)}h
                      </TableCell>
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
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatCurrency(ts.gross_pay)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ts.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        {ts.status === "pending" ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              aria-label="Approve timesheet"
                              onClick={() => handleApprove(ts.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              aria-label="Reject timesheet"
                              onClick={() => handleReject(ts.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {ts.status !== "approved" && (
                                <DropdownMenuItem
                                  onClick={() => handleApprove(ts.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />{" "}
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {ts.status !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => handleReject(ts.id)}
                                >
                                  <XCircle className="h-4 w-4 mr-2 text-red-600" />{" "}
                                  Reject
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleAdjust(ts)}
                              >
                                <Edit3 className="h-4 w-4 mr-2" /> Adjust Hours
                              </DropdownMenuItem>
                              {ts.status !== "pending" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateTimesheet(ts.id, {
                                      status: "pending",
                                    })
                                  }
                                >
                                  <Clock className="h-4 w-4 mr-2" /> Reset to
                                  Pending
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {/* Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Timesheet Hours</DialogTitle>
            <DialogDescription>
              {adjustTarget &&
                `${adjustTarget.staff_name} — ${format(new Date(adjustTarget.date), "EEE, MMM d")}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Adjusted Hours</label>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={adjustHours}
                onChange={(e) => setAdjustHours(e.target.value)}
                className="mt-1"
              />
              {adjustTarget && (
                <p className="text-xs text-muted-foreground mt-1">
                  Original: {adjustTarget.total_hours.toFixed(2)}h
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">
                Reason for Adjustment *
              </label>
              <Textarea
                placeholder="e.g. Stayed late for close, early finish approved by manager..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAdjustDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAdjustment}
              disabled={!adjustReason.trim()}
            >
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
