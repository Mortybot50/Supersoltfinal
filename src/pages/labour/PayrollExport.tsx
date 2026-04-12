import { useState, useMemo, Fragment } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Clock,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useDataStore } from "@/lib/store/dataStore";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  subWeeks,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PageShell, PageToolbar, StatusBadge } from "@/components/shared";
import { StatCards } from "@/components/ui/StatCards";
import { SecondaryStats } from "@/components/ui/SecondaryStats";
import { formatLabourCost } from "@/lib/utils/rosterCalculations";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  buildPayrollCSV,
  downloadCSV,
  type PayrollExportFormat,
} from "@/lib/services/timesheetService";

type PayrollPeriod =
  | "this-week"
  | "last-week"
  | "this-fortnight"
  | "this-month";

interface PenaltyLine {
  type: string;
  label: string;
  hours: number;
  baseCost: number;
  penaltyCost: number;
  totalCost: number;
  multiplier: number;
}

const PENALTY_LABELS: Record<string, string> = {
  none: "Base Rate",
  saturday: "Saturday Loading (125%)",
  sunday: "Sunday Loading (150%)",
  public_holiday: "Public Holiday (250%)",
  evening: "Evening Loading (115%)",
  late_night: "Late Night Loading (125%)",
  early_morning: "Early Morning Loading (115%)",
  overtime: "Overtime",
};

export default function PayrollExport() {
  const navigate = useNavigate();
  const { staff, timesheets, rosterShifts } = useDataStore();

  const [period, setPeriod] = useState<PayrollPeriod>("this-week");
  const [exportFormat, setExportFormat] = useState<PayrollExportFormat>("csv");
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedStaff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "this-week":
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case "last-week": {
        const lastWeek = subWeeks(now, 1);
        return {
          start: startOfWeek(lastWeek, { weekStartsOn: 1 }),
          end: endOfWeek(lastWeek, { weekStartsOn: 1 }),
        };
      }
      case "this-fortnight": {
        const twoWeeksAgo = subWeeks(now, 1);
        return {
          start: startOfWeek(twoWeeksAgo, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      }
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [period]);

  const approvedTimesheets = useMemo(() => {
    return timesheets.filter((ts) => {
      if (ts.status !== "approved") return false;
      const tsDate = new Date(ts.date);
      return isWithinInterval(tsDate, {
        start: dateRange.start,
        end: dateRange.end,
      });
    });
  }, [timesheets, dateRange]);

  const staffBreakdown = useMemo(() => {
    const activeStaff = staff.filter((s) => s.status === "active");

    return activeStaff
      .map((s) => {
        const staffTimesheets = approvedTimesheets.filter(
          (ts) => ts.staff_id === s.id,
        );
        const actualHours = staffTimesheets.reduce(
          (sum, ts) => sum + ts.total_hours,
          0,
        );
        const grossPay = staffTimesheets.reduce(
          (sum, ts) => sum + ts.gross_pay,
          0,
        );

        // Rostered shifts for period (for penalty breakdown)
        const rosteredShifts = rosterShifts.filter((shift) => {
          const shiftDate = new Date(shift.date);
          return (
            shift.staff_id === s.id &&
            isWithinInterval(shiftDate, {
              start: dateRange.start,
              end: dateRange.end,
            }) &&
            shift.status !== "cancelled"
          );
        });
        const rosteredHours = rosteredShifts.reduce(
          (sum, shift) => sum + shift.total_hours,
          0,
        );

        // Penalty line breakdown
        const penaltyMap: Record<string, PenaltyLine> = {};
        let totalBaseCost = 0;
        let totalPenaltyCost = 0;

        rosteredShifts.forEach((shift) => {
          const pType = shift.penalty_type || "none";
          totalBaseCost += shift.base_cost || 0;
          totalPenaltyCost += shift.penalty_cost || 0;

          if (!penaltyMap[pType]) {
            penaltyMap[pType] = {
              type: pType,
              label: PENALTY_LABELS[pType] || pType,
              hours: 0,
              baseCost: 0,
              penaltyCost: 0,
              totalCost: 0,
              multiplier: shift.penalty_multiplier || 1,
            };
          }
          penaltyMap[pType].hours += shift.total_hours;
          penaltyMap[pType].baseCost += shift.base_cost || 0;
          penaltyMap[pType].penaltyCost += shift.penalty_cost || 0;
          penaltyMap[pType].totalCost += shift.total_cost || 0;
        });

        // Overtime detection (full-time > 38h/week)
        if (s.employment_type === "full-time" && actualHours > 38) {
          const overtimeHours = actualHours - 38;
          const overtimeCost = Math.round(overtimeHours * s.hourly_rate * 1.5);
          penaltyMap["overtime"] = {
            type: "overtime",
            label: "Overtime (150%)",
            hours: overtimeHours,
            baseCost: Math.round(overtimeHours * s.hourly_rate),
            penaltyCost: Math.round(overtimeHours * s.hourly_rate * 0.5),
            totalCost: overtimeCost,
            multiplier: 1.5,
          };
        }

        const penaltyLines = Object.values(penaltyMap).sort((a, b) => {
          if (a.type === "none") return -1;
          if (b.type === "none") return 1;
          return b.totalCost - a.totalCost;
        });

        const superAmount = Math.round(grossPay * 0.115); // 11.5% OTE
        const variance = actualHours - rosteredHours;

        return {
          id: s.id,
          name: s.name,
          role: s.role,
          employmentType: s.employment_type,
          hourlyRate: s.hourly_rate,
          rosteredHours,
          actualHours,
          variance,
          grossPay,
          baseCost: totalBaseCost,
          penaltyCost: totalPenaltyCost,
          penaltyLines,
          superAmount,
          total: grossPay + superAmount,
          entryCount: staffTimesheets.length,
        };
      })
      .filter((s) => s.entryCount > 0 || s.rosteredHours > 0)
      .sort((a, b) => b.actualHours - a.actualHours);
  }, [staff, approvedTimesheets, rosterShifts, dateRange]);

  const totalPenaltyCost = useMemo(
    () => staffBreakdown.reduce((sum, s) => sum + s.penaltyCost, 0),
    [staffBreakdown],
  );

  const totals = useMemo(
    () => ({
      rosteredHours: staffBreakdown.reduce(
        (sum, s) => sum + s.rosteredHours,
        0,
      ),
      actualHours: staffBreakdown.reduce((sum, s) => sum + s.actualHours, 0),
      grossPay: staffBreakdown.reduce((sum, s) => sum + s.grossPay, 0),
      superAmount: staffBreakdown.reduce((sum, s) => sum + s.superAmount, 0),
      total: staffBreakdown.reduce((sum, s) => sum + s.total, 0),
      staffCount: staffBreakdown.length,
    }),
    [staffBreakdown],
  );

  const pendingCount = useMemo(() => {
    return timesheets.filter((ts) => {
      if (ts.status !== "pending") return false;
      const tsDate = new Date(ts.date);
      return isWithinInterval(tsDate, {
        start: dateRange.start,
        end: dateRange.end,
      });
    }).length;
  }, [timesheets, dateRange]);

  const handleExport = () => {
    if (staffBreakdown.length === 0) {
      toast.error("No approved timesheets to export");
      return;
    }

    const rows = staffBreakdown.map((s) => ({
      name: s.name,
      role: s.role,
      actualHours: s.actualHours,
      rosteredHours: s.rosteredHours,
      variance: s.variance,
      hourlyRate: s.hourlyRate,
      baseCost: s.baseCost,
      penaltyCost: s.penaltyCost,
      grossPay: s.grossPay,
      superAmount: s.superAmount,
      total: s.total,
    }));

    const csv = buildPayrollCSV(
      rows,
      exportFormat,
      dateRange.start,
      dateRange.end,
    );
    const periodLabel = `${format(dateRange.start, "yyyy-MM-dd")}_${format(dateRange.end, "yyyy-MM-dd")}`;
    downloadCSV(csv, `payroll-${exportFormat}-${periodLabel}.csv`);
    toast.success(
      `Exported ${staffBreakdown.length} staff to ${exportFormat.toUpperCase()} format`,
    );
  };

  // ── Period date navigation ──────────────────────────────────────────────────

  const [customWeekOffset, setCustomWeekOffset] = useState(0);
  const periodLabel =
    period === "this-week" ||
    period === "last-week" ||
    period === "this-fortnight"
      ? `${format(dateRange.start, "d MMM")} – ${format(dateRange.end, "d MMM yyyy")}`
      : format(dateRange.start, "MMMM yyyy");
  void customWeekOffset;
  void setCustomWeekOffset;

  const toolbar = (
    <PageToolbar
      title="Payroll Export"
      filters={
        <div className="flex items-center gap-2">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as PayrollPeriod)}
          >
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
          <span className="text-xs text-muted-foreground">{periodLabel}</span>
        </div>
      }
      primaryAction={{
        label: "Export CSV",
        icon: Download,
        onClick: handleExport,
        variant: "export",
      }}
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards
          stats={[
            {
              label: "Total Hours",
              value: `${totals.actualHours.toFixed(1)}h`,
            },
            { label: "Gross Pay", value: formatLabourCost(totals.grossPay) },
            { label: "Staff", value: totals.staffCount },
          ]}
          columns={3}
        />
        <SecondaryStats
          stats={[
            ...(totalPenaltyCost > 0
              ? [
                  {
                    label: "Penalty Loading",
                    value: formatLabourCost(totalPenaltyCost),
                  },
                ]
              : []),
            {
              label: "Super (11.5%)",
              value: formatLabourCost(totals.superAmount),
            },
            { label: "Total Cost", value: formatLabourCost(totals.total) },
          ]}
        />
      </div>

      {pendingCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border-b px-4 py-2 flex items-center gap-3">
          <Clock className="h-4 w-4 text-yellow-600 shrink-0" />
          <span className="text-sm text-yellow-800 dark:text-yellow-200">
            {pendingCount} pending timesheets need approval before export
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-yellow-700 shrink-0"
            onClick={() => navigate("/workforce/timesheets")}
          >
            Approve Timesheets
          </Button>
        </div>
      )}

      <div className="p-4">
        {/* Export format selector */}
        <div className="flex items-center gap-2 mb-4">
          <Select
            value={exportFormat}
            onValueChange={(v) => setExportFormat(v as PayrollExportFormat)}
          >
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Type</TableHead>
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
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground h-32"
                >
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payroll data for this period</p>
                  <p className="text-sm mt-1">
                    Approve timesheets to generate payroll
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {staffBreakdown.map((s) => {
                  const isExpanded = expandedStaff.has(s.id);
                  const hasPenalties =
                    s.penaltyLines.length > 1 ||
                    (s.penaltyLines.length === 1 &&
                      s.penaltyLines[0].type !== "none");

                  return (
                    <Fragment key={s.id}>
                      <TableRow
                        className={
                          hasPenalties ? "cursor-pointer hover:bg-muted/50" : ""
                        }
                        onClick={() => hasPenalties && toggleExpand(s.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {hasPenalties &&
                              (isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ))}
                            {s.name}
                            {s.penaltyCost > 0 && (
                              <Badge
                                variant="outline"
                                className="ml-1 text-[9px] px-1 py-0 text-orange-600 border-orange-200 bg-orange-50"
                              >
                                +{formatLabourCost(s.penaltyCost)}
                              </Badge>
                            )}
                            {s.employmentType === "full-time" &&
                              s.actualHours > 38 && (
                                <Badge
                                  variant="outline"
                                  className="ml-1 text-[9px] px-1 py-0 text-red-600 border-red-200 bg-red-50"
                                >
                                  OT
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={s.role as "manager" | "supervisor" | "crew"}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {s.rosteredHours.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right">
                          {s.actualHours.toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-xs font-medium ${
                              Math.abs(s.variance) <= 0.5
                                ? "text-green-600"
                                : Math.abs(s.variance) <= 1
                                  ? "text-orange-600"
                                  : "text-red-600"
                            }`}
                          >
                            {s.variance >= 0 ? "+" : ""}
                            {s.variance.toFixed(1)}h
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(s.hourlyRate)}/hr
                        </TableCell>
                        <TableCell className="text-right">
                          {formatLabourCost(s.grossPay)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatLabourCost(s.superAmount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatLabourCost(s.total)}
                        </TableCell>
                      </TableRow>

                      {/* Penalty breakdown rows */}
                      {isExpanded &&
                        s.penaltyLines.map((line) => (
                          <TableRow
                            key={`${s.id}-${line.type}`}
                            className="bg-muted/30"
                          >
                            <TableCell
                              className="pl-10 text-xs text-muted-foreground"
                              colSpan={2}
                            >
                              {line.label}
                              {line.multiplier > 1 && (
                                <Badge
                                  variant="outline"
                                  className="ml-1.5 text-[9px] px-1 py-0"
                                >
                                  {Math.round(line.multiplier * 100)}%
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {line.hours.toFixed(1)}h
                            </TableCell>
                            <TableCell />
                            <TableCell />
                            <TableCell />
                            <TableCell className="text-right text-xs">
                              {line.type === "none" ? (
                                formatLabourCost(line.baseCost)
                              ) : (
                                <span className="text-orange-600">
                                  {formatLabourCost(line.baseCost)} +{" "}
                                  {formatLabourCost(line.penaltyCost)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right text-xs font-medium">
                              {formatLabourCost(line.totalCost)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </Fragment>
                  );
                })}

                {/* Totals row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell>Totals</TableCell>
                  <TableCell>{totals.staffCount} staff</TableCell>
                  <TableCell className="text-right">
                    {totals.rosteredHours.toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-right">
                    {totals.actualHours.toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`text-xs font-medium ${
                        Math.abs(totals.actualHours - totals.rosteredHours) <= 2
                          ? "text-green-600"
                          : "text-orange-600"
                      }`}
                    >
                      {totals.actualHours - totals.rosteredHours >= 0
                        ? "+"
                        : ""}
                      {(totals.actualHours - totals.rosteredHours).toFixed(1)}h
                    </span>
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right">
                    {formatLabourCost(totals.grossPay)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatLabourCost(totals.superAmount)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatLabourCost(totals.total)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  );
}
