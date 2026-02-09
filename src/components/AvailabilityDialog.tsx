import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useEffect } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { StaffAvailability, Staff } from "@/types"
import { useDataStore } from "@/lib/store/dataStore"
import { toast } from "sonner"

const DAYS_OF_WEEK = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
]

const availabilitySchema = z.object({
  staff_id: z.string().min(1, "Staff member is required"),
  type: z.enum(["available", "unavailable", "preferred"]),
  is_recurring: z.boolean(),
  day_of_week: z.string().optional(),
  specific_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  notes: z.string().optional(),
})

type AvailabilityFormValues = z.infer<typeof availabilitySchema>

interface AvailabilityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availability?: StaffAvailability
  staffId?: string
}

export function AvailabilityDialog({
  open,
  onOpenChange,
  availability,
  staffId,
}: AvailabilityDialogProps) {
  const { staff, addStaffAvailability, updateStaffAvailability } = useDataStore()
  const activeStaff = staff.filter((s) => s.status === "active")

  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      staff_id: staffId || "",
      type: "available",
      is_recurring: true,
      day_of_week: "1",
      specific_date: "",
      start_time: "",
      end_time: "",
      notes: "",
    },
  })

  const isRecurring = form.watch("is_recurring")

  useEffect(() => {
    if (availability) {
      form.reset({
        staff_id: availability.staff_id,
        type: availability.type,
        is_recurring: availability.is_recurring,
        day_of_week: availability.day_of_week?.toString() || "1",
        specific_date: availability.specific_date
          ? new Date(availability.specific_date).toISOString().split("T")[0]
          : "",
        start_time: availability.start_time || "",
        end_time: availability.end_time || "",
        notes: availability.notes || "",
      })
    } else {
      form.reset({
        staff_id: staffId || "",
        type: "available",
        is_recurring: true,
        day_of_week: "1",
        specific_date: "",
        start_time: "",
        end_time: "",
        notes: "",
      })
    }
  }, [availability, staffId, form])

  const onSubmit = (values: AvailabilityFormValues) => {
    const data: StaffAvailability = {
      id: availability?.id || `avail-${Date.now()}`,
      staff_id: values.staff_id,
      venue_id: "venue-1",
      type: values.type,
      is_recurring: values.is_recurring,
      day_of_week: values.is_recurring ? parseInt(values.day_of_week || "1") : undefined,
      specific_date: !values.is_recurring && values.specific_date
        ? new Date(values.specific_date)
        : undefined,
      start_time: values.start_time || undefined,
      end_time: values.end_time || undefined,
      notes: values.notes,
      created_at: availability?.created_at || new Date(),
      updated_at: new Date(),
    }

    if (availability) {
      updateStaffAvailability(availability.id, data)
      toast.success("Availability updated")
    } else {
      addStaffAvailability(data)
      toast.success("Availability added")
    }

    form.reset()
    onOpenChange(false)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "available":
        return "Available"
      case "unavailable":
        return "Unavailable"
      case "preferred":
        return "Preferred"
      default:
        return type
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {availability ? "Edit Availability" : "Add Availability"}
          </DialogTitle>
          <DialogDescription>
            Set when a staff member is available or unavailable for shifts
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
                      {activeStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Availability Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="available">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Available
                        </span>
                      </SelectItem>
                      <SelectItem value="unavailable">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Unavailable
                        </span>
                      </SelectItem>
                      <SelectItem value="preferred">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Preferred
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_recurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Recurring weekly</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {isRecurring ? (
              <FormField
                control={form.control}
                name="day_of_week"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Day of Week</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="specific_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specific Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Time</FormLabel>
                    <FormControl>
                      <Input type="time" placeholder="All day" {...field} />
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
                    <FormLabel>To Time</FormLabel>
                    <FormControl>
                      <Input type="time" placeholder="All day" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Leave times empty for all day availability
            </p>

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
              <Button type="submit">
                {availability ? "Update" : "Add"} Availability
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
