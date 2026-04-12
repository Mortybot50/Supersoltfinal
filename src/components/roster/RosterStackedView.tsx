import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { RosterShift, Staff, RosterGroupBy } from "@/types";
import { RosterShiftCard } from "./RosterShiftCard";
import {
  isPublicHoliday,
  getPublicHolidayName,
  getRoleColor,
  formatLabourCost,
} from "@/lib/utils/rosterCalculations";
import { format } from "date-fns";

interface RosterStackedViewProps {
  dates: Date[];
  shifts: RosterShift[];
  staff: Staff[];
  groupBy: RosterGroupBy;
  getDayTotals: (date: Date) => { hours: number; cost: number; count: number };
  onAddShift: (date?: Date, staffId?: string) => void;
  onEditShift: (shift: RosterShift) => void;
  onDeleteShift: (shift: RosterShift) => void;
  onRequestSwap: (shift: RosterShift) => void;
}

export function RosterStackedView({
  dates,
  shifts,
  staff,
  groupBy,
  getDayTotals,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onRequestSwap,
}: RosterStackedViewProps) {
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

  const getStaffName = (staffId: string) => {
    return staff.find((s) => s.id === staffId)?.name || "Unknown";
  };

  const groupShifts = (dayShifts: RosterShift[]) => {
    if (groupBy === "none") return [{ label: null, shifts: dayShifts }];

    const groups = new Map<string, RosterShift[]>();
    dayShifts.forEach((shift) => {
      const staffMember = staff.find((s) => s.id === shift.staff_id);
      const key =
        groupBy === "team"
          ? staffMember?.role || "Other"
          : staffMember?.employment_type || "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(shift);
    });

    return Array.from(groups.entries()).map(([label, shifts]) => ({
      label,
      shifts,
    }));
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex min-w-[900px]">
        {dates.map((date) => {
          const dayShifts = getShiftsForDate(date);
          const dayTotals = getDayTotals(date);
          const holiday = isPublicHoliday(date);
          const holidayName = getPublicHolidayName(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isToday = new Date().toDateString() === date.toDateString();
          const grouped = groupShifts(dayShifts);

          return (
            <div
              key={date.toISOString()}
              className={`flex-1 border-r min-w-[120px] ${
                isToday
                  ? "bg-blue-50/50 dark:bg-blue-950/30"
                  : holiday
                    ? "bg-purple-50/30 dark:bg-purple-950/20"
                    : isWeekend
                      ? "bg-orange-50/30 dark:bg-orange-950/20"
                      : ""
              }`}
            >
              {/* Day Header */}
              <div
                className={`sticky top-0 z-10 bg-white dark:bg-gray-800 border-b p-2 text-center ${
                  isToday ? "bg-blue-50 dark:bg-blue-950" : ""
                }`}
              >
                <div
                  className={`font-medium text-sm ${isToday ? "text-blue-600" : ""}`}
                >
                  {format(date, "EEE d MMM")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dayTotals.count > 0
                    ? `${dayTotals.hours.toFixed(1)}h · ${dayTotals.count} shifts · ${formatLabourCost(dayTotals.cost)}`
                    : "No shifts"}
                </div>
                {holiday && (
                  <Badge
                    variant="outline"
                    className="mt-1 text-[9px] bg-purple-100 text-purple-700 border-purple-200"
                  >
                    {holidayName || "Holiday"}
                  </Badge>
                )}
              </div>

              {/* Shifts */}
              <div className="p-1 space-y-1">
                {grouped.map((group, gi) => (
                  <div key={gi}>
                    {group.label && (
                      <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <div
                          className={`w-2 h-2 rounded ${getRoleColor(group.label).bg}`}
                        />
                        {group.label}
                      </div>
                    )}

                    {group.shifts.map((shift) => (
                      <RosterShiftCard
                        key={shift.id}
                        shift={shift}
                        staffName={getStaffName(shift.staff_id)}
                        onEdit={onEditShift}
                        onDelete={onDeleteShift}
                        onRequestSwap={onRequestSwap}
                        showStaffName={true}
                        showCost={true}
                      />
                    ))}
                  </div>
                ))}

                {dayShifts.length === 0 && (
                  <div className="text-center py-8 text-xs text-gray-400">
                    No shifts
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onAddShift(date)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Shift
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
