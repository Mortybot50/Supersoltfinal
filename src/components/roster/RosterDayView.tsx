import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  RosterShift,
  Staff,
  StaffAvailability,
  HourlyStaffing,
  DayStats,
} from "@/types";
import { DayDemandChart } from "./DayDemandChart";
import {
  formatTimeCompact,
  formatLabourCost,
  getRoleColor,
} from "@/lib/utils/rosterCalculations";
import { format } from "date-fns";

interface RosterDayViewProps {
  selectedDay: Date;
  fortnightDates: Date[];
  shifts: RosterShift[];
  allShifts: RosterShift[];
  staff: Staff[];
  hourlyStaffing: HourlyStaffing[];
  dayStats: DayStats;
  onDaySelect: (date: Date) => void;
  onAddShift: (date?: Date, staffId?: string) => void;
  onEditShift: (shift: RosterShift) => void;
  onDeleteShift: (shift: RosterShift) => void;
  onRequestSwap: (shift: RosterShift) => void;
}

const ROLE_BADGE_LABELS: Record<string, string> = {
  manager: "MGR",
  management: "MGR",
  supervisor: "SUP",
  crew: "CRW",
  kitchen: "KIT",
  foh: "FOH",
  bar: "BAR",
};

// Timeline runs from 6am to 11pm = 17 hours
const TIMELINE_START = 6;
const TIMELINE_END = 23;
const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START;

export function RosterDayView({
  selectedDay,
  fortnightDates,
  shifts,
  allShifts,
  staff,
  hourlyStaffing,
  dayStats,
  onDaySelect,
  onAddShift,
  onEditShift,
}: RosterDayViewProps) {
  const selectedDateStr = selectedDay.toISOString().split("T")[0];

  // Sort shifts by start time
  const sortedShifts = useMemo(
    () =>
      [...shifts]
        .filter((s) => !s.is_open_shift && s.status !== "cancelled")
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [shifts],
  );

  // Count shifts per day for the fortnight strip
  const shiftCountsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    allShifts.forEach((s) => {
      if (s.status === "cancelled" || s.is_open_shift) return;
      const d = new Date(s.date).toISOString().split("T")[0];
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [allShifts]);

  const getStaffName = (staffId: string) => {
    return staff.find((s) => s.id === staffId)?.name || "Unknown";
  };

  const getStaffRole = (staffId: string) => {
    return staff.find((s) => s.id === staffId)?.role || "crew";
  };

  // Calculate position of shift bar on timeline
  const getShiftPosition = (startTime: string, endTime: string) => {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    let startPos = startH + startM / 60;
    let endPos = endH + endM / 60;
    if (endPos <= startPos) endPos += 24;

    // Clamp to timeline range
    startPos = Math.max(startPos, TIMELINE_START);
    endPos = Math.min(endPos, TIMELINE_END);

    const left = ((startPos - TIMELINE_START) / TIMELINE_RANGE) * 100;
    const width = ((endPos - startPos) / TIMELINE_RANGE) * 100;

    return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
  };

  // Generate timeline hour markers
  const timelineHours = useMemo(() => {
    const hours = [];
    for (let h = TIMELINE_START; h <= TIMELINE_END; h++) {
      const ampm = h >= 12 ? "pm" : "am";
      const h12 = h % 12 || 12;
      hours.push({ hour: h, label: `${h12}${ampm}` });
    }
    return hours;
  }, []);

  return (
    <div className="flex-1 overflow-auto">
      {/* Fortnight Navigation Strip */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="flex">
          {fortnightDates.map((date) => {
            const dateStr = date.toISOString().split("T")[0];
            const isSelected = dateStr === selectedDateStr;
            const isToday = new Date().toDateString() === date.toDateString();
            const shiftCount = shiftCountsByDate[dateStr] || 0;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <button
                key={dateStr}
                className={`flex-1 py-2 px-1 text-center border-r cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-500 text-white"
                    : isToday
                      ? "bg-blue-50 dark:bg-blue-950"
                      : isWeekend
                        ? "bg-gray-50 dark:bg-gray-850"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => onDaySelect(date)}
              >
                <div className="text-xs font-medium">{format(date, "EEE")}</div>
                <div
                  className={`text-sm font-bold ${isSelected ? "" : isToday ? "text-blue-600" : ""}`}
                >
                  {format(date, "d")}
                </div>
                {shiftCount > 0 && (
                  <div
                    className={`text-[10px] ${isSelected ? "text-blue-100" : "text-muted-foreground"}`}
                  >
                    {shiftCount} shifts
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Demand Chart */}
      <div className="bg-white dark:bg-gray-800 border-b p-4">
        <DayDemandChart hourlyStaffing={hourlyStaffing} dayStats={dayStats} />
      </div>

      {/* Gantt Timeline */}
      <div className="bg-white dark:bg-gray-800 border-b">
        {/* Time Axis */}
        <div className="flex border-b ml-48">
          {timelineHours.map(({ hour, label }) => (
            <div
              key={hour}
              className="flex-1 text-center text-[10px] text-muted-foreground py-1 border-r"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Shift Bars */}
        <div className="divide-y">
          {sortedShifts.map((shift) => {
            const pos = getShiftPosition(shift.start_time, shift.end_time);
            const role = getStaffRole(shift.staff_id);
            const roleBadge = ROLE_BADGE_LABELS[role.toLowerCase()] || "CRW";
            const roleColor = getRoleColor(role);

            return (
              <div
                key={shift.id}
                className="flex items-center h-10 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                {/* Staff Info */}
                <div className="w-48 shrink-0 flex items-center gap-2 px-3 border-r">
                  <Badge
                    className={`${roleColor.bg} text-white text-[9px] px-1.5 py-0 h-5 font-bold`}
                  >
                    {roleBadge}
                  </Badge>
                  <span className="text-xs font-medium truncate">
                    {formatTimeCompact(shift.start_time)} -{" "}
                    {formatTimeCompact(shift.end_time)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {getStaffName(shift.staff_id)}
                  </span>
                </div>

                {/* Timeline Bar */}
                <div className="flex-1 relative h-full">
                  {/* Hour grid lines */}
                  <div className="absolute inset-0 flex">
                    {timelineHours.map(({ hour }) => (
                      <div
                        key={hour}
                        className="flex-1 border-r border-gray-100 dark:border-gray-800"
                      />
                    ))}
                  </div>

                  {/* Shift bar */}
                  <div
                    className={`absolute top-1.5 h-7 rounded cursor-pointer transition-opacity hover:opacity-80 flex items-center px-1.5 gap-1 ${roleColor.bg}`}
                    style={{ left: pos.left, width: pos.width }}
                    onClick={() => onEditShift(shift)}
                  >
                    <span className="text-[9px] text-white font-medium truncate">
                      {shift.total_hours.toFixed(1)}h ·{" "}
                      {formatLabourCost(shift.total_cost)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {sortedShifts.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No shifts scheduled for this day
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
