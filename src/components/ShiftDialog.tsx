import { useAuth } from "@/contexts/AuthContext"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useEffect, useMemo } from "react"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RosterShift, Staff, StaffAvailability } from "@/types"
import { useDataStore } from "@/lib/store/dataStore"
import { calculateShiftHoursAndCost, hasShiftConflict, getRoleColor, formatLabourCost } from "@/lib/utils/rosterCalculations"
import { toast } from "@/hooks/use-toast"
import { AlertCircle, AlertTriangle, UserX } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const shiftSchema = z.object({
  staff_id: z.string().min(1, "Staff member is required"),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  break_minutes: z.string(),
  role: z.enum(["manager", "supervisor", "crew"]),
  notes: z.string().optional(),
})

type ShiftFormValues = z.infer<typeof shiftSchema>

interface ShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: RosterShift
  defaultDate?: Date
  onSave: (shift: RosterShift) => void
}

export function ShiftDialog({ open, onOpenChange, shift, defaultDate, onSave }: ShiftDialogProps) {
  const { currentVenue } = useAuth()
  const { staff, rosterShifts, staffAvailability } = useDataStore()
  const activeStaff = staff.filter((s) => s.status === "active")

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      staff_id: "",
      date: new Date().toISOString().split("T")[0],
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: "30",
      role: "crew",
      notes: "",
    },
  })

  // Reset form when shift or defaultDate changes
  useEffect(() => {
    if (shift) {
      form.reset({
        staff_id: shift.staff_id,
        date: typeof shift.date === "string"
          ? shift.date
          : new Date(shift.date).toISOString().split("T")[0],
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_minutes: shift.break_minutes.toString(),
        role: shift.role as "manager" | "supervisor" | "crew",
        notes: shift.notes || "",
      })
    } else {
      form.reset({
        staff_id: "",
        date: defaultDate
          ? defaultDate.toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        start_time: "09:00",
        end_time: "17:00",
        break_minutes: "30",
        role: "crew",
        notes: "",
      })
    }
  }, [shift, defaultDate, form])

  // Watch form values for live calculation
  const watchedValues = form.watch()
  const selectedStaff = activeStaff.find((s) => s.id === watchedValues.staff_id)

  // Calculate hours and cost in real-time (with penalty rates)
  const calculation = useMemo(() => {
    if (!watchedValues.start_time || !watchedValues.end_time) {
      return { hours: 0, cost: 0, baseCost: 0, penaltyCost: 0, penaltyType: 'none', penaltyMultiplier: 1, warnings: [] as string[] }
    }
    const hourlyRate = selectedStaff?.hourly_rate || 0
    const shiftDate = watchedValues.date ? new Date(watchedValues.date) : undefined
    return calculateShiftHoursAndCost(
      watchedValues.start_time,
      watchedValues.end_time,
      parseInt(watchedValues.break_minutes) || 0,
      hourlyRate,
      shiftDate
    )
  }, [watchedValues.start_time, watchedValues.end_time, watchedValues.break_minutes, watchedValues.date, selectedStaff])

  // Check for conflicts
  const hasConflict = useMemo(() => {
    if (!watchedValues.staff_id || !watchedValues.date || !watchedValues.start_time || !watchedValues.end_time) {
      return false
    }
    return hasShiftConflict(
      rosterShifts,
      watchedValues.staff_id,
      new Date(watchedValues.date),
      watchedValues.start_time,
      watchedValues.end_time,
      shift?.id
    )
  }, [watchedValues.staff_id, watchedValues.date, watchedValues.start_time, watchedValues.end_time, rosterShifts, shift])

  // Check staff availability for selected date/time
  const availabilityWarning = useMemo(() => {
    if (!watchedValues.staff_id || !watchedValues.date) return null

    const shiftDate = new Date(watchedValues.date)
    const dayOfWeek = shiftDate.getDay() // 0=Sun, 6=Sat
    const dateStr = shiftDate.toISOString().split("T")[0]

    const staffAvail = staffAvailability.filter((a) => a.staff_id === watchedValues.staff_id)
    if (staffAvail.length === 0) return null

    for (const avail of staffAvail) {
      if (avail.type !== "unavailable") continue

      // Check if this unavailability applies to this date
      let applies = false
      if (avail.is_recurring && avail.day_of_week === dayOfWeek) {
        applies = true
      } else if (avail.specific_date) {
        const availDateStr = new Date(avail.specific_date).toISOString().split("T")[0]
        if (availDateStr === dateStr) applies = true
      }

      if (!applies) continue

      // If all-day unavailability
      if (!avail.start_time && !avail.end_time) {
        return {
          message: `${selectedStaff?.name || "Staff"} is marked unavailable on ${avail.is_recurring ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek] + "s" : format(shiftDate, "MMM d")}`,
          notes: avail.notes,
        }
      }

      // Time-range unavailability — check overlap with shift times
      if (avail.start_time && avail.end_time && watchedValues.start_time && watchedValues.end_time) {
        const shiftStart = watchedValues.start_time
        const shiftEnd = watchedValues.end_time
        const unavailStart = avail.start_time
        const unavailEnd = avail.end_time

        // Simple overlap check: shift overlaps unavailability if shiftStart < unavailEnd && shiftEnd > unavailStart
        if (shiftStart < unavailEnd && shiftEnd > unavailStart) {
          return {
            message: `${selectedStaff?.name || "Staff"} is unavailable ${unavailStart}-${unavailEnd}${avail.is_recurring ? " (recurring)" : ""}`,
            notes: avail.notes,
          }
        }
      }
    }

    // Check for "preferred" times (softer warning)
    for (const avail of staffAvail) {
      if (avail.type !== "preferred") continue
      if (avail.is_recurring && avail.day_of_week === dayOfWeek && avail.start_time && avail.end_time) {
        const shiftStart = watchedValues.start_time
        const shiftEnd = watchedValues.end_time
        // If shift is outside preferred window
        if (shiftStart < avail.start_time || shiftEnd > avail.end_time) {
          return {
            message: `${selectedStaff?.name || "Staff"} prefers ${avail.start_time}-${avail.end_time} on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek]}s`,
            notes: avail.notes,
            isPreference: true,
          }
        }
      }
    }

    return null
  }, [watchedValues.staff_id, watchedValues.date, watchedValues.start_time, watchedValues.end_time, staffAvailability, selectedStaff])

  const onSubmit = (values: ShiftFormValues) => {
    const staffMember = activeStaff.find((s) => s.id === values.staff_id)
    if (!staffMember) {
      toast({
        title: "Error",
        description: "Selected staff member not found",
        variant: "destructive",
      })
      return
    }

    if (hasConflict) {
      toast({
        title: "Shift Conflict",
        description: "This shift overlaps with an existing shift for this staff member",
        variant: "destructive",
      })
      return
    }

    const shiftDate = new Date(values.date)
    const calc = calculateShiftHoursAndCost(
      values.start_time,
      values.end_time,
      parseInt(values.break_minutes) || 0,
      staffMember.hourly_rate,
      shiftDate
    )

    const shiftData: RosterShift = {
      id: shift?.id || `shift-${Date.now()}`,
      venue_id: shift?.venue_id || currentVenue?.id || "",
      staff_id: values.staff_id,
      staff_name: staffMember.name,
      date: shiftDate,
      start_time: values.start_time,
      end_time: values.end_time,
      break_minutes: parseInt(values.break_minutes) || 0,
      role: values.role,
      notes: values.notes,
      status: 'scheduled',
      total_hours: calc.hours,
      base_cost: calc.baseCost,
      penalty_cost: calc.penaltyCost,
      total_cost: calc.cost,
      penalty_type: calc.penaltyType as RosterShift['penalty_type'],
      penalty_multiplier: calc.penaltyMultiplier,
      warnings: calc.warnings,
    }

    onSave(shiftData)

    toast({
      title: shift ? "Shift updated" : "Shift added",
      description: `${staffMember.name}'s shift on ${values.date} has been ${shift ? "updated" : "added"}.`,
    })

    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{shift ? "Edit Shift" : "Add Shift"}</DialogTitle>
          <DialogDescription>
            {shift ? "Update shift details" : "Schedule a new shift for a team member"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="staff_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staff Member *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeStaff.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No active staff members
                        </SelectItem>
                      ) : (
                        activeStaff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.role})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="crew">Crew</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="break_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Break (mins)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Live calculation display */}
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Hours:</span>
                <span className="font-medium">{calculation.hours.toFixed(2)}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Cost:</span>
                <span className="font-medium">{formatLabourCost(calculation.baseCost)}</span>
              </div>
              {calculation.penaltyCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-orange-600">Penalty Loading:</span>
                  <span className="text-orange-600 font-medium">
                    +{formatLabourCost(calculation.penaltyCost)} ({Math.round(calculation.penaltyMultiplier * 100)}%)
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-1 mt-1">
                <span className="font-medium">Total Cost:</span>
                <span className="font-bold">{formatLabourCost(calculation.cost)}</span>
              </div>
              {selectedStaff && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Rate:</span>
                  <span className="text-muted-foreground">
                    ${(selectedStaff.hourly_rate / 100).toFixed(2)}/hr
                  </span>
                </div>
              )}
              {calculation.penaltyType !== 'none' && (
                <div className="mt-2">
                  <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-200 bg-orange-50 capitalize">
                    {calculation.penaltyType.replace('_', ' ')} rate applies
                  </Badge>
                </div>
              )}
            </div>

            {/* Award compliance warnings */}
            {calculation.warnings && calculation.warnings.length > 0 && (
              <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3 space-y-1">
                {calculation.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Availability warning */}
            {availabilityWarning && (
              <div className={`flex items-start gap-2 rounded-lg p-3 ${
                availabilityWarning.isPreference
                  ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                  : "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
              }`}>
                <UserX className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <span className="text-sm font-medium">{availabilityWarning.message}</span>
                  {availabilityWarning.notes && (
                    <p className="text-xs mt-0.5 opacity-80">{availabilityWarning.notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* Conflict warning */}
            {hasConflict && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">This shift overlaps with an existing shift</span>
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={hasConflict}>
                {shift ? "Update Shift" : "Add Shift"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
