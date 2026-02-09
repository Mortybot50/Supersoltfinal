import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useEffect, useMemo } from "react"
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
import { RosterShift, Staff } from "@/types"
import { useDataStore } from "@/lib/store/dataStore"
import { calculateShiftHoursAndCost, hasShiftConflict } from "@/lib/utils/rosterCalculations"
import { toast } from "@/hooks/use-toast"
import { AlertCircle } from "lucide-react"

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
  const { staff, rosterShifts } = useDataStore()
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
      return { hours: 0, cost: 0, baseCost: 0, penaltyCost: 0, penaltyType: 'none', penaltyMultiplier: 1 }
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
      venue_id: shift?.venue_id || "venue-1",
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
                <span className="text-muted-foreground">Estimated Cost:</span>
                <span className="font-medium">${(calculation.cost / 100).toFixed(2)}</span>
              </div>
              {calculation.penaltyCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-orange-600">Penalty Loading:</span>
                  <span className="text-orange-600 font-medium">
                    +${(calculation.penaltyCost / 100).toFixed(2)} ({Math.round(calculation.penaltyMultiplier * 100)}%)
                  </span>
                </div>
              )}
              {selectedStaff && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Rate:</span>
                  <span className="text-muted-foreground">
                    ${(selectedStaff.hourly_rate / 100).toFixed(2)}/hr
                  </span>
                </div>
              )}
              {calculation.penaltyType !== 'none' && (
                <div className="mt-2 text-xs text-orange-600 capitalize">
                  {calculation.penaltyType.replace('_', ' ')} rate applies
                </div>
              )}
            </div>

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
