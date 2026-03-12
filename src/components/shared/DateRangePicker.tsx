import { useState, useEffect } from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface DateRangePickerProps {
  from: Date
  to: Date
  onApply: (from: Date, to: Date) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DateRangePicker({ from, to, onApply, open, onOpenChange }: DateRangePickerProps) {
  const [range, setRange] = useState<DateRange | undefined>({ from, to })

  useEffect(() => {
    if (open) setRange({ from, to })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="h-0 w-0 overflow-hidden inline-block" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={2}
          initialFocus
        />
        <div className="flex items-center justify-between p-3 border-t gap-3">
          <span className="text-sm text-muted-foreground">
            {range?.from && range?.to
              ? `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}`
              : range?.from
              ? `${format(range.from, "d MMM yyyy")} – ...`
              : "Select a date range"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!range?.from || !range?.to}
              onClick={() => {
                if (range?.from && range?.to) {
                  onApply(range.from, range.to)
                  onOpenChange(false)
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
