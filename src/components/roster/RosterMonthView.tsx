import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { RosterShift } from "@/types";
import {
  isPublicHoliday,
  formatTimeCompact,
} from "@/lib/utils/rosterCalculations";
import { format, startOfMonth, getDay } from "date-fns";

interface RosterMonthViewProps {
  monthDates: Date[];
  shifts: RosterShift[];
  getDayTotals: (date: Date) => { hours: number; cost: number; count: number };
  onDayClick: (date: Date) => void;
  onAddShift: (date?: Date, staffId?: string) => void;
}

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function RosterMonthView({
  monthDates,
  shifts,
  getDayTotals,
  onDayClick,
}: RosterMonthViewProps) {
  // Build calendar grid (weeks × 7 days)
  const weeks = useMemo(() => {
    if (monthDates.length === 0) return [];

    const firstDay = monthDates[0];
    const monthNum = firstDay.getMonth();

    // Get the Monday before or on the first of the month
    const day = getDay(firstDay); // 0=Sun, 1=Mon, ...
    const padBefore = day === 0 ? 6 : day - 1; // number of days to pad before

    const grid: Array<{ date: Date; inMonth: boolean }[]> = [];
    let currentWeek: Array<{ date: Date; inMonth: boolean }> = [];

    // Pad days before month
    for (let i = padBefore; i > 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i);
      currentWeek.push({ date: d, inMonth: false });
    }

    // Month dates
    monthDates.forEach((date) => {
      currentWeek.push({ date, inMonth: true });
      if (currentWeek.length === 7) {
        grid.push(currentWeek);
        currentWeek = [];
      }
    });

    // Pad days after month
    if (currentWeek.length > 0) {
      const lastDate = monthDates[monthDates.length - 1];
      let nextDay = 1;
      while (currentWeek.length < 7) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + nextDay);
        currentWeek.push({ date: d, inMonth: false });
        nextDay++;
      }
      grid.push(currentWeek);
    }

    return grid;
  }, [monthDates]);

  const getShiftsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return shifts
      .filter((s) => {
        const shiftDate = new Date(s.date).toISOString().split("T")[0];
        return (
          shiftDate === dateStr && s.status !== "cancelled" && !s.is_open_shift
        );
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  return (
    <div className="flex-1 overflow-auto p-2">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {DAY_HEADERS.map((day) => (
              <th
                key={day}
                className="p-2 text-center text-xs font-medium text-muted-foreground border-b"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map(({ date, inMonth }) => {
                const dayShifts = getShiftsForDate(date);
                const dayTotals = getDayTotals(date);
                const isToday =
                  new Date().toDateString() === date.toDateString();
                const holiday = isPublicHoliday(date);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const maxVisible = 3;

                return (
                  <td
                    key={date.toISOString()}
                    className={`border p-1 align-top h-24 min-w-[100px] cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      !inMonth
                        ? "bg-gray-50/50 dark:bg-gray-900/50 opacity-50"
                        : isToday
                          ? "bg-blue-50 dark:bg-blue-950/30"
                          : holiday
                            ? "bg-purple-50/30 dark:bg-purple-950/20"
                            : isWeekend
                              ? "bg-orange-50/20 dark:bg-orange-950/10"
                              : ""
                    }`}
                    onClick={() => onDayClick(date)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium ${
                          isToday
                            ? "bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                            : !inMonth
                              ? "text-muted-foreground"
                              : ""
                        }`}
                      >
                        {format(date, "d")}
                      </span>
                      {dayTotals.hours > 0 && (
                        <span className="text-[9px] text-muted-foreground">
                          {dayTotals.hours.toFixed(1)}h
                        </span>
                      )}
                    </div>

                    <div className="space-y-0.5">
                      {dayShifts.slice(0, maxVisible).map((shift) => (
                        <div
                          key={shift.id}
                          className="text-[9px] truncate px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                        >
                          {formatTimeCompact(shift.start_time)}-
                          {formatTimeCompact(shift.end_time)}
                        </div>
                      ))}

                      {dayShifts.length > maxVisible && (
                        <div className="text-[9px] text-muted-foreground px-1">
                          +{dayShifts.length - maxVisible} more
                        </div>
                      )}

                      {dayShifts.length === 0 && inMonth && (
                        <div className="text-[9px] text-gray-300 dark:text-gray-600 text-center mt-2">
                          —
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
