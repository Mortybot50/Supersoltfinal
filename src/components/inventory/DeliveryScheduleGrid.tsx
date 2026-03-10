import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const DAY_FULL_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export interface DeliveryScheduleEntry {
  day: number // 0-6 (0=Sunday)
  is_order_day: boolean
  order_by_time: string | null // HH:MM
  delivery_day: number | null // 0-6
}

export function getDefaultSchedule(): DeliveryScheduleEntry[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    is_order_day: false,
    order_by_time: null,
    delivery_day: null,
  }))
}

interface DeliveryScheduleGridProps {
  schedule: DeliveryScheduleEntry[]
  onChange: (schedule: DeliveryScheduleEntry[]) => void
  disabled?: boolean
}

export function DeliveryScheduleGrid({ schedule, onChange, disabled = false }: DeliveryScheduleGridProps) {
  const entries = schedule.length === 7 ? schedule : getDefaultSchedule()

  const updateEntry = (dayIndex: number, updates: Partial<DeliveryScheduleEntry>) => {
    const updated = entries.map((entry, i) =>
      i === dayIndex ? { ...entry, ...updates } : entry
    )
    onChange(updated)
  }

  return (
    <Card className="p-4">
      <Label className="text-sm font-semibold mb-3 block">Delivery Schedule</Label>
      <div className="overflow-x-auto -mx-2 px-2">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
          {entries.map((entry, idx) => (
            <div
              key={entry.day}
              className={`rounded-lg border p-3 space-y-3 ${
                entry.is_order_day ? 'border-primary/40 bg-primary/5' : 'border-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`order-day-${idx}`}
                  checked={entry.is_order_day}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    updateEntry(idx, {
                      is_order_day: checked as boolean,
                      order_by_time: checked ? (entry.order_by_time || '14:00') : null,
                      delivery_day: checked ? entry.delivery_day : null,
                    })
                  }
                />
                <Label
                  htmlFor={`order-day-${idx}`}
                  className="text-sm font-semibold cursor-pointer"
                >
                  {DAY_LABELS[idx]}
                </Label>
              </div>

              {entry.is_order_day && (
                <>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Order By</Label>
                    <Input
                      type="time"
                      value={entry.order_by_time || '14:00'}
                      disabled={disabled}
                      className="h-8 text-xs mt-1"
                      onChange={(e) => updateEntry(idx, { order_by_time: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground">Delivery Day</Label>
                    <Select
                      value={entry.delivery_day?.toString() ?? ''}
                      disabled={disabled}
                      onValueChange={(v) => updateEntry(idx, { delivery_day: parseInt(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_FULL_LABELS.map((label, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Check days when orders can be placed. Set cut-off time and expected delivery day for each.
      </p>
    </Card>
  )
}
