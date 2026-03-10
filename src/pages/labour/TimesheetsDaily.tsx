import { useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { format, parseISO, startOfWeek } from "date-fns"
import { ArrowLeft, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageShell, PageToolbar, StatusBadge } from "@/components/shared"
import { useDataStore } from "@/lib/store/dataStore"
import { formatCurrency } from "@/lib/utils/formatters"

// Timeline spans 05:00 – 24:00 (19 hours)
const TIMELINE_START_HOUR = 5
const TIMELINE_TOTAL_HOURS = 19

function hourToPercent(hour: number, minute = 0): number {
  const offset = hour + minute / 60 - TIMELINE_START_HOUR
  return Math.max(0, Math.min(100, (offset / TIMELINE_TOTAL_HOURS) * 100))
}

function parseHHMM(t: string | undefined): { h: number; m: number } | null {
  if (!t) return null
  const [h, m] = t.split(":").map(Number)
  return { h, m }
}

export default function TimesheetsDaily() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { timesheets, rosterShifts, staff } = useDataStore()

  const targetDate = useMemo(() => {
    try {
      return date ? parseISO(date) : new Date()
    } catch {
      return new Date()
    }
  }, [date])

  const targetDateStr = useMemo(
    () => format(targetDate, "yyyy-MM-dd"),
    [targetDate],
  )

  // Staff rows: merge timesheets + roster shifts for the day
  const rows = useMemo(() => {
    const activeStaff = staff.filter((s) => s.status === "active")

    return activeStaff
      .map((s) => {
        const dayTimesheets = timesheets.filter((ts) => {
          const d = new Date(ts.date).toISOString().split("T")[0]
          return ts.staff_id === s.id && d === targetDateStr
        })

        const dayShifts = rosterShifts.filter((shift) => {
          const d = new Date(shift.date).toISOString().split("T")[0]
          return (
            shift.staff_id === s.id &&
            d === targetDateStr &&
            shift.status !== "cancelled"
          )
        })

        if (dayTimesheets.length === 0 && dayShifts.length === 0) return null

        const ts = dayTimesheets[0]
        const shift = dayShifts[0]

        // Rostered bar from shift start/end times
        const rosteredStart = shift ? parseHHMM(shift.start_time) : null
        const rosteredEnd = shift ? parseHHMM(shift.end_time) : null

        // Actual bar from timesheet clock_in/clock_out
        const actualStart = ts?.clock_in
          ? (() => {
              const d = new Date(ts.clock_in)
              return { h: d.getHours(), m: d.getMinutes() }
            })()
          : null
        const actualEnd = ts?.clock_out
          ? (() => {
              const d = new Date(ts.clock_out)
              return { h: d.getHours(), m: d.getMinutes() }
            })()
          : null

        const rosteredLeft = rosteredStart
          ? hourToPercent(rosteredStart.h, rosteredStart.m)
          : null
        const rosteredRight = rosteredEnd
          ? hourToPercent(rosteredEnd.h, rosteredEnd.m)
          : null
        const actualLeft = actualStart
          ? hourToPercent(actualStart.h, actualStart.m)
          : null
        const actualRight = actualEnd
          ? hourToPercent(actualEnd.h, actualEnd.m)
          : null

        return {
          staff: s,
          timesheet: ts,
          shift,
          rosteredLeft,
          rosteredRight,
          actualLeft,
          actualRight,
          variance: ts && shift ? ts.total_hours - shift.total_hours : null,
        }
      })
      .filter(Boolean)
  }, [staff, timesheets, rosterShifts, targetDateStr])

  // Time axis tick marks
  const ticks = useMemo(() => {
    const result: { label: string; left: number }[] = []
    for (let h = TIMELINE_START_HOUR; h <= TIMELINE_START_HOUR + TIMELINE_TOTAL_HOURS; h += 2) {
      result.push({
        label: h < 24 ? `${h}:00` : `${h - 24}:00`,
        left: hourToPercent(h),
      })
    }
    return result
  }, [])

  const toolbar = (
    <PageToolbar
      title={format(targetDate, "EEEE, d MMMM yyyy")}
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() =>
            navigate(
              `/workforce/timesheets?week=${format(
                startOfWeek(targetDate, { weekStartsOn: 1 }),
                "yyyy-MM-dd",
              )}`,
            )
          }
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Week
        </Button>
      }
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 space-y-2">
        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2.5 rounded bg-blue-400 opacity-70" />
            Rostered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2.5 rounded bg-green-500" />
            Worked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2.5 rounded bg-red-400" />
            Overtime / Variance
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Clock className="h-10 w-10 mb-3 opacity-40" />
            <p>No shifts or timesheets for this day</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Time axis header */}
            <div className="flex pl-40 pr-4">
              <div className="relative flex-1 h-5">
                {ticks.map((tick) => (
                  <span
                    key={tick.label}
                    className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
                    style={{ left: `${tick.left}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>

            {rows.map((row) => {
              if (!row) return null
              const { staff: s, timesheet: ts, shift, rosteredLeft, rosteredRight, actualLeft, actualRight, variance } = row

              return (
                <div key={s.id} className="flex items-center gap-3">
                  {/* Staff label */}
                  <div className="w-36 shrink-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {ts && <StatusBadge status={ts.status} size="sm" />}
                      {variance !== null && (
                        <span
                          className={`text-[10px] font-medium ${
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
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="relative flex-1 h-8 bg-muted/40 rounded overflow-hidden border border-border/50">
                    {/* Tick grid lines */}
                    {ticks.map((tick) => (
                      <div
                        key={tick.label}
                        className="absolute top-0 bottom-0 w-px bg-border/40"
                        style={{ left: `${tick.left}%` }}
                      />
                    ))}

                    {/* Rostered bar */}
                    {rosteredLeft !== null && rosteredRight !== null && (
                      <div
                        className="absolute top-1.5 h-2 rounded bg-blue-400 opacity-60"
                        style={{
                          left: `${rosteredLeft}%`,
                          width: `${Math.max(0.5, rosteredRight - rosteredLeft)}%`,
                        }}
                        title={shift ? `Rostered: ${shift.start_time}–${shift.end_time}` : "Rostered"}
                      />
                    )}

                    {/* Actual bar */}
                    {actualLeft !== null && actualRight !== null && (
                      <div
                        className="absolute bottom-1.5 h-2 rounded bg-green-500"
                        style={{
                          left: `${actualLeft}%`,
                          width: `${Math.max(0.5, actualRight - actualLeft)}%`,
                        }}
                        title={ts ? `Worked: ${format(new Date(ts.clock_in), "h:mm a")}–${ts.clock_out ? format(new Date(ts.clock_out), "h:mm a") : "ongoing"}` : "Worked"}
                      />
                    )}

                    {/* Overtime extension (actual beyond rostered) */}
                    {rosteredRight !== null && actualRight !== null && actualRight > rosteredRight && (
                      <div
                        className="absolute bottom-1.5 h-2 rounded bg-red-400"
                        style={{
                          left: `${rosteredRight}%`,
                          width: `${Math.max(0.5, actualRight - rosteredRight)}%`,
                        }}
                        title="Overtime"
                      />
                    )}
                  </div>

                  {/* Summary */}
                  <div className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    {ts ? (
                      <>
                        <p className="font-medium text-foreground">{ts.total_hours.toFixed(1)}h</p>
                        <p>{formatCurrency(ts.gross_pay)}</p>
                      </>
                    ) : shift ? (
                      <>
                        <p className="font-medium text-foreground">{shift.total_hours.toFixed(1)}h</p>
                        <p className="text-muted-foreground">Rostered</p>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageShell>
  )
}
