import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Users, CalendarClock, Ban, Check, DollarSign } from "lucide-react"
import { RosterShift, Staff, StaffAvailability, RosterGroupBy } from "@/types"
import { RosterShiftCard } from "./RosterShiftCard"
import { isPublicHoliday, getPublicHolidayName, getRoleColor, formatLabourCost } from "@/lib/utils/rosterCalculations"
import { format } from "date-fns"

interface RosterStaffViewProps {
  dates: Date[]
  activeStaff: Staff[]
  weekShifts: RosterShift[]
  staffAvailability: StaffAvailability[]
  groupBy: RosterGroupBy
  compact?: boolean
  getShiftsForStaffOnDate: (staffId: string, date: Date) => RosterShift[]
  getAvailabilityForStaffOnDate: (staffId: string, date: Date) => StaffAvailability | null
  getStaffWeeklyHours: (staffId: string) => number
  getDayTotals: (date: Date) => { hours: number; cost: number; count: number }
  onAddShift: (date?: Date, staffId?: string) => void
  onEditShift: (shift: RosterShift) => void
  onDeleteShift: (shift: RosterShift) => void
  onRequestSwap: (shift: RosterShift) => void
  onAddAvailability: (staffId?: string) => void
}

export function RosterStaffView({
  dates,
  activeStaff,
  weekShifts,
  staffAvailability,
  groupBy,
  compact = false,
  getShiftsForStaffOnDate,
  getAvailabilityForStaffOnDate,
  getStaffWeeklyHours,
  getDayTotals,
  onAddShift,
  onEditShift,
  onDeleteShift,
  onRequestSwap,
  onAddAvailability,
}: RosterStaffViewProps) {
  const groupedStaff = useMemo(() => {
    if (groupBy === "none") return [{ label: null, staff: activeStaff }]

    const groupField = groupBy === "team" ? "role" : "employment_type"
    const groups = new Map<string, Staff[]>()

    activeStaff.forEach((s) => {
      const key = (s as any)[groupField] || "Other"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    })

    return Array.from(groups.entries()).map(([label, staff]) => ({
      label,
      staff,
    }))
  }, [activeStaff, groupBy])

  // Compute weekly cost per staff
  const staffWeeklyCosts = useMemo(() => {
    const costs: Record<string, number> = {}
    weekShifts.forEach((s) => {
      if (s.status !== "cancelled" && !s.is_open_shift) {
        costs[s.staff_id] = (costs[s.staff_id] || 0) + s.total_cost
      }
    })
    return costs
  }, [weekShifts])

  const colMinWidth = compact ? "min-w-[90px]" : "min-w-[120px]"
  const totalCols = dates.length + (compact ? 1 : 2)

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse min-w-[900px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-white dark:bg-gray-800 border-b">
            <th className="w-52 p-0 border-r sticky left-0 z-20 bg-white dark:bg-gray-800">
              <div className="p-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Staff</span>
              </div>
            </th>

            {dates.map((date) => {
              const dayTotals = getDayTotals(date)
              const holiday = isPublicHoliday(date)
              const holidayName = getPublicHolidayName(date)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              const isToday = new Date().toDateString() === date.toDateString()

              return (
                <th
                  key={date.toISOString()}
                  className={`p-2 text-center ${colMinWidth} border-r ${
                    isToday ? "bg-blue-50 dark:bg-blue-950" : ""
                  }`}
                >
                  <div className={`font-medium ${compact ? "text-xs" : "text-sm"} ${isToday ? "text-blue-600" : ""}`}>
                    {compact ? format(date, "EEE d") : format(date, "EEE d MMM")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dayTotals.count > 0 ? `${dayTotals.hours.toFixed(1)}h · ${formatLabourCost(dayTotals.cost)}` : "\u2014"}
                  </div>
                  {holiday && (
                    <Badge variant="outline" className="mt-1 text-[9px] bg-purple-100 text-purple-700 border-purple-200">
                      {holidayName || "Holiday"}
                    </Badge>
                  )}
                  {isWeekend && !holiday && (
                    <Badge variant="outline" className="mt-1 text-[9px] bg-orange-100 text-orange-700 border-orange-200">
                      {date.getDay() === 6 ? "Sat" : "Sun"}
                    </Badge>
                  )}
                </th>
              )
            })}

            {/* Weekly totals column */}
            {!compact && (
              <th className="w-24 p-2 text-center border-r bg-slate-50 dark:bg-slate-800">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Weekly</div>
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {activeStaff.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active staff members</p>
                <p className="text-sm mt-2">Add staff in the People section to start rostering</p>
              </td>
            </tr>
          ) : (
            groupedStaff.map((group) => (
              <>
                {group.label && (
                  <tr key={`group-${group.label}`} className="bg-slate-100 dark:bg-slate-800">
                    <td
                      colSpan={totalCols}
                      className="px-4 py-2 font-semibold text-sm text-slate-700 dark:text-slate-300 border-b"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${getRoleColor(group.label).bg}`} />
                        {group.label}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({group.staff.length} staff)
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {group.staff.map((staffMember) => {
                  const weeklyHours = getStaffWeeklyHours(staffMember.id)
                  const weeklyCost = staffWeeklyCosts[staffMember.id] || 0
                  const maxHours = 40
                  const hoursPercent = Math.min((weeklyHours / maxHours) * 100, 100)
                  const overtimeWarning = weeklyHours > 38

                  return (
                    <tr
                      key={staffMember.id}
                      className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="p-2 border-r sticky left-0 bg-white dark:bg-gray-900 z-10">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${getRoleColor(staffMember.role).bg} shrink-0`} />
                              <span className="font-medium text-sm truncate">{staffMember.name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-xs ${overtimeWarning ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                                {weeklyHours.toFixed(1)}h
                              </span>
                              {!compact && (
                                <span className="text-xs text-muted-foreground">
                                  {formatLabourCost(weeklyCost)}
                                </span>
                              )}
                            </div>
                            <div className="mt-1">
                              <Progress
                                value={hoursPercent}
                                className={`h-1 ${overtimeWarning ? "[&>div]:bg-red-500" : ""}`}
                              />
                            </div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2 shrink-0"
                                onClick={() => onAddAvailability(staffMember.id)}
                              >
                                <CalendarClock className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Manage Availability</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>

                      {dates.map((date) => {
                        const shiftsOnDate = getShiftsForStaffOnDate(staffMember.id, date)
                        const availability = getAvailabilityForStaffOnDate(staffMember.id, date)
                        const holiday = isPublicHoliday(date)
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        const isToday = new Date().toDateString() === date.toDateString()
                        const hasShifts = shiftsOnDate.length > 0
                        const isUnavailable = availability?.type === "unavailable"

                        return (
                          <td
                            key={date.toISOString()}
                            className={`p-1 border-r align-top min-h-[60px] ${
                              isToday
                                ? "bg-blue-50/50 dark:bg-blue-950/30"
                                : holiday
                                ? "bg-purple-50/30 dark:bg-purple-950/20"
                                : isWeekend
                                ? "bg-orange-50/30 dark:bg-orange-950/20"
                                : ""
                            }`}
                            onClick={() =>
                              !hasShifts && !isUnavailable && onAddShift(date, staffMember.id)
                            }
                          >
                            <div className="min-h-[50px] space-y-1">
                              {availability && !hasShifts && (
                                <div
                                  className={`rounded px-2 py-1.5 text-xs ${
                                    availability.type === "unavailable"
                                      ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                      : availability.type === "preferred"
                                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                      : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                  }`}
                                >
                                  <div className="flex items-center gap-1">
                                    {availability.type === "unavailable" ? (
                                      <Ban className="h-3 w-3" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                    <span>
                                      {availability.start_time
                                        ? `${availability.start_time} - ${availability.end_time}`
                                        : "All Day"}
                                    </span>
                                  </div>
                                  {availability.notes && (
                                    <div className="text-[10px] mt-0.5 truncate">
                                      {availability.notes}
                                    </div>
                                  )}
                                </div>
                              )}

                              {shiftsOnDate.map((shift) => (
                                <RosterShiftCard
                                  key={shift.id}
                                  shift={shift}
                                  staffName={staffMember.name}
                                  onEdit={onEditShift}
                                  onDelete={onDeleteShift}
                                  onRequestSwap={onRequestSwap}
                                  compact={compact}
                                  showStaffName={false}
                                  showCost={!compact}
                                />
                              ))}

                              {!hasShifts && !availability && (
                                <div className="h-full min-h-[40px] flex items-center justify-center text-xs text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded group">
                                  <span className="opacity-0 group-hover:opacity-100">+ Add</span>
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}

                      {/* Weekly totals cell */}
                      {!compact && (
                        <td className="p-2 border-r bg-slate-50/50 dark:bg-slate-800/50 align-top">
                          <div className="text-xs text-center space-y-1">
                            <div className={`font-semibold ${overtimeWarning ? "text-red-600" : ""}`}>
                              {weeklyHours.toFixed(1)}h
                            </div>
                            <div className="text-muted-foreground">
                              {formatLabourCost(weeklyCost)}
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </>
            ))
          )}

          {/* Daily totals footer row */}
          <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 sticky bottom-0">
            <td className="p-2 border-r sticky left-0 bg-slate-100 dark:bg-slate-800 z-10">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Day Totals</span>
              </div>
            </td>
            {dates.map((date) => {
              const dayTotals = getDayTotals(date)
              return (
                <td key={date.toISOString()} className="p-2 text-center border-r">
                  <div className="text-xs font-semibold">{dayTotals.count} shifts</div>
                  <div className="text-[10px] text-muted-foreground">{dayTotals.hours.toFixed(1)}h</div>
                  <div className="text-[10px] font-medium">{formatLabourCost(dayTotals.cost)}</div>
                </td>
              )
            })}
            {!compact && (
              <td className="p-2 text-center border-r bg-slate-100 dark:bg-slate-800">
                <div className="text-xs font-bold">
                  {dates.reduce((sum, d) => sum + getDayTotals(d).hours, 0).toFixed(1)}h
                </div>
                <div className="text-[10px] font-semibold">
                  {formatLabourCost(dates.reduce((sum, d) => sum + getDayTotals(d).cost, 0))}
                </div>
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
