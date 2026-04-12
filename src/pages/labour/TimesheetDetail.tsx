import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  format,
  parseISO,
  eachDayOfInterval,
  addDays,
  startOfDay,
} from "date-fns";
import { ArrowLeft, CheckCircle, XCircle, Edit3, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageToolbar, StatusBadge } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { useDataStore } from "@/lib/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  adjustTimesheet,
  approveTimesheet,
} from "@/lib/services/timesheetService";
import type { Timesheet } from "@/types";

const REASON_CODES = [
  "Early finish — manager approved",
  "Stayed late — cover required",
  "Clocked in late",
  "System error — manual correction",
  "No-show partial attendance",
  "Other",
];

function formatTime(d: Date | string | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "h:mm a");
}

export default function TimesheetDetail() {
  const { staffId, periodStart } = useParams<{
    staffId: string;
    periodStart: string;
  }>();
  const navigate = useNavigate();
  const {
    timesheets,
    rosterShifts,
    staff,
    approveTimesheet: storeApprove,
    rejectTimesheet: storeReject,
    updateTimesheet: storeUpdate,
  } = useDataStore();
  const { profile } = useAuth();

  // Adjust dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Timesheet | null>(null);
  const [adjustHours, setAdjustHours] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Approve/reject note dialog
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteAction, setNoteAction] = useState<"approve" | "reject">("approve");
  const [noteText, setNoteText] = useState("");
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);

  const periodStartDate = useMemo(() => {
    try {
      return periodStart ? parseISO(periodStart) : new Date();
    } catch {
      return new Date();
    }
  }, [periodStart]);

  const periodEndDate = useMemo(
    () => addDays(periodStartDate, 6),
    [periodStartDate],
  );

  const staffMember = useMemo(
    () => staff.find((s) => s.id === staffId),
    [staff, staffId],
  );

  const periodDays = useMemo(
    () => eachDayOfInterval({ start: periodStartDate, end: periodEndDate }),
    [periodStartDate, periodEndDate],
  );

  // Map day → timesheet & rostered shift
  const dayRows = useMemo(() => {
    return periodDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");

      const ts = timesheets.find((t) => {
        const d = new Date(t.date).toISOString().split("T")[0];
        return t.staff_id === staffId && d === dateStr;
      });

      const shift = rosterShifts.find((s) => {
        const d = new Date(s.date).toISOString().split("T")[0];
        return (
          s.staff_id === staffId && d === dateStr && s.status !== "cancelled"
        );
      });

      const variance = ts && shift ? ts.total_hours - shift.total_hours : null;

      return { day, dateStr, ts, shift, variance };
    });
  }, [periodDays, timesheets, rosterShifts, staffId]);

  const metrics = useMemo(() => {
    const entries = dayRows.filter((r) => r.ts);
    const totalHours = entries.reduce(
      (sum, r) => sum + (r.ts?.total_hours ?? 0),
      0,
    );
    const totalPay = entries.reduce(
      (sum, r) => sum + (r.ts?.gross_pay ?? 0),
      0,
    );
    const pendingCount = entries.filter(
      (r) => r.ts?.status === "pending",
    ).length;
    const approvedCount = entries.filter(
      (r) => r.ts?.status === "approved",
    ).length;
    const rosteredHours = dayRows.reduce(
      (sum, r) => sum + (r.shift?.total_hours ?? 0),
      0,
    );
    return { totalHours, totalPay, pendingCount, approvedCount, rosteredHours };
  }, [dayRows]);

  // ── Adjust ───────────────────────────────────────────────────────────────

  const openAdjust = (ts: Timesheet) => {
    setAdjustTarget(ts);
    setAdjustHours(ts.total_hours.toFixed(2));
    setAdjustReason("");
    setAdjustOpen(true);
  };

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
    setAdjustLoading(true);
    const payPerHour =
      adjustTarget.total_hours > 0
        ? adjustTarget.gross_pay / adjustTarget.total_hours
        : (staffMember?.hourly_rate ?? 0);
    const newPay = Math.round(newHours * payPerHour);
    const prevNote = adjustTarget.notes ? `${adjustTarget.notes} | ` : "";
    const fullNote = `${prevNote}Adjusted: ${adjustReason} (was ${adjustTarget.total_hours.toFixed(2)}h)`;

    const ok = await adjustTimesheet(
      adjustTarget.id,
      { total_hours: newHours, gross_pay: newPay, notes: fullNote },
      adjustReason,
      profile?.id ?? "unknown",
    );
    if (ok) {
      storeUpdate(adjustTarget.id, {
        total_hours: newHours,
        gross_pay: newPay,
        notes: fullNote,
      });
      toast.success(`Hours adjusted to ${newHours.toFixed(2)}h`);
    }
    setAdjustLoading(false);
    setAdjustOpen(false);
    setAdjustTarget(null);
  };

  // ── Approve / reject with note ────────────────────────────────────────────

  const openNote = (id: string, action: "approve" | "reject") => {
    setNoteTarget(id);
    setNoteAction(action);
    setNoteText("");
    setNoteOpen(true);
  };

  const handleNoteConfirm = async () => {
    if (!noteTarget) return;
    setNoteLoading(true);

    if (noteAction === "approve") {
      const ok = await approveTimesheet(noteTarget, profile?.id ?? "unknown");
      if (ok) {
        storeApprove(noteTarget);
        if (noteText.trim())
          storeUpdate(noteTarget, { notes: noteText.trim() });
        toast.success("Timesheet approved");
      }
    } else {
      storeReject(noteTarget);
      if (noteText.trim()) storeUpdate(noteTarget, { notes: noteText.trim() });
      toast.success("Timesheet rejected");
    }

    setNoteLoading(false);
    setNoteOpen(false);
    setNoteTarget(null);
  };

  const toolbar = (
    <PageToolbar
      title={staffMember ? staffMember.name : "Staff Detail"}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => navigate("/workforce/timesheets")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      }
      primaryAction={
        metrics.pendingCount > 0
          ? {
              label: `Approve All (${metrics.pendingCount})`,
              onClick: async () => {
                const pending = dayRows.filter(
                  (r) => r.ts?.status === "pending",
                );
                let count = 0;
                for (const row of pending) {
                  if (!row.ts) continue;
                  const ok = await approveTimesheet(
                    row.ts.id,
                    profile?.id ?? "unknown",
                  );
                  if (ok) {
                    storeApprove(row.ts.id);
                    count++;
                  }
                }
                toast.success(`${count} timesheets approved`);
              },
              variant: "primary",
            }
          : undefined
      }
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      {/* Subtitle */}
      <div className="px-4 py-2 border-b bg-muted/30">
        <p className="text-sm text-muted-foreground">
          {format(periodStartDate, "d MMM")} –{" "}
          {format(periodEndDate, "d MMM yyyy")}
          {staffMember && (
            <>
              {" · "}
              <Badge variant="outline" className="text-xs capitalize">
                {staffMember.employment_type}
              </Badge>{" "}
              <Badge variant="outline" className="text-xs capitalize">
                {staffMember.role}
              </Badge>
            </>
          )}
        </p>
      </div>

      <div className="px-4 pt-4 pb-2">
        <StatCards
          stats={[
            {
              label: "Rostered",
              value: `${metrics.rosteredHours.toFixed(1)}h`,
            },
            { label: "Worked", value: `${metrics.totalHours.toFixed(1)}h` },
            { label: "Gross Pay", value: formatCurrency(metrics.totalPay) },
            { label: "Pending", value: metrics.pendingCount },
          ]}
          columns={4}
        />
      </div>

      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Break</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Variance</TableHead>
              <TableHead className="text-right">Pay</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dayRows.map(({ day, ts, shift, variance }) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <TableRow
                  key={format(day, "yyyy-MM-dd")}
                  className={isWeekend ? "bg-muted/20" : ""}
                >
                  <TableCell className="font-medium">
                    {format(day, "EEE, d MMM")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {shift ? `${shift.start_time}–${shift.end_time}` : "—"}
                  </TableCell>
                  <TableCell>{formatTime(ts?.clock_in)}</TableCell>
                  <TableCell>{formatTime(ts?.clock_out)}</TableCell>
                  <TableCell className="text-xs">
                    {ts ? `${ts.break_minutes}m` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {ts ? `${ts.total_hours.toFixed(2)}h` : "—"}
                  </TableCell>
                  <TableCell>
                    {variance !== null ? (
                      <span
                        className={`text-xs font-medium ${
                          Math.abs(variance) <= 0.5
                            ? "text-green-600"
                            : Math.abs(variance) <= 1
                              ? "text-orange-500"
                              : "text-red-500"
                        }`}
                      >
                        {variance >= 0 ? "+" : ""}
                        {variance.toFixed(1)}h
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {ts ? formatCurrency(ts.gross_pay) : "—"}
                  </TableCell>
                  <TableCell>
                    {ts ? (
                      <StatusBadge status={ts.status} size="sm" />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No entry
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ts ? (
                      <div className="flex items-center gap-1">
                        {ts.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600 hover:bg-green-50"
                              aria-label="Approve"
                              onClick={() => openNote(ts.id, "approve")}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 hover:bg-red-50"
                              aria-label="Reject"
                              onClick={() => openNote(ts.id, "reject")}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          aria-label="Adjust hours"
                          onClick={() => openAdjust(ts)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Notes column if any adjustments exist */}
      {dayRows.some((r) => r.ts?.notes) && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Adjustment Notes
          </p>
          {dayRows
            .filter((r) => r.ts?.notes)
            .map(({ day, ts }) => (
              <div
                key={format(day, "yyyy-MM-dd")}
                className="text-xs bg-muted/40 rounded px-3 py-2"
              >
                <span className="font-medium">{format(day, "EEE d")}: </span>
                {ts?.notes}
              </div>
            ))}
        </div>
      )}

      {/* Adjust hours dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Hours</DialogTitle>
            <DialogDescription>
              {adjustTarget &&
                `${format(new Date(adjustTarget.date), "EEE, d MMM")} — original: ${adjustTarget.total_hours.toFixed(2)}h`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Adjusted Hours</label>
              <Input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={adjustHours}
                onChange={(e) => setAdjustHours(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason Code *</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              >
                <option value="">Select reason…</option>
                {REASON_CODES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAdjustment}
              disabled={!adjustReason || adjustLoading}
            >
              {adjustLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve / Reject with note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {noteAction === "approve"
                ? "Approve Timesheet"
                : "Reject Timesheet"}
            </DialogTitle>
            <DialogDescription>Optional note for the record</DialogDescription>
          </DialogHeader>
          <div>
            <Textarea
              placeholder="e.g. Approved by manager on duty…"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleNoteConfirm}
              disabled={noteLoading}
              className={
                noteAction === "approve"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {noteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {noteAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
