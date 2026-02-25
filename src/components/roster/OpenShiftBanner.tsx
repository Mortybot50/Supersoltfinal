/**
 * OpenShiftBanner — shows unassigned/open shifts at the bottom of the roster.
 * Staff can claim open shifts; managers can assign them.
 */

import { useMemo } from 'react'
import { useRosterStore } from '@/stores/useRosterStore'
import { format } from 'date-fns'
import { formatTimeCompact } from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import { UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export function OpenShiftBanner() {
  const { openShifts, staff, updateShift, deleteShift, selectedDate } = useRosterStore()

  const weekStart = selectedDate
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const visibleOpenShifts = useMemo(() => {
    return openShifts.filter(s => {
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      return d >= weekStart && d <= weekEnd && s.status !== 'cancelled'
    })
  }, [openShifts, weekStart])

  if (visibleOpenShifts.length === 0) return null

  const handleAssign = async (shiftId: string, staffId: string) => {
    const member = staff.find(s => s.id === staffId)
    if (!member) return
    await updateShift(shiftId, {
      staff_id: member.id,
      staff_name: member.name,
      is_open_shift: false,
    })
    toast.success(`Assigned to ${member.name}`)
  }

  const handleDelete = async (shiftId: string) => {
    await deleteShift(shiftId)
    toast.success('Open shift removed')
  }

  return (
    <div className="bg-blue-50 border-t border-blue-200 px-3 py-2 print:hidden">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-blue-800">
          {visibleOpenShifts.length} Open Shift{visibleOpenShifts.length > 1 ? 's' : ''}
        </span>
        <span className="text-xs text-blue-500">— unassigned, needs coverage</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleOpenShifts.map(shift => {
          const d = shift.date instanceof Date ? shift.date : new Date(shift.date)
          return (
            <div
              key={shift.id}
              className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-2 py-1.5 text-xs"
            >
              <div>
                <span className="font-medium text-blue-800">{format(d, 'EEE d')}</span>
                <span className="text-blue-600 ml-1">
                  {formatTimeCompact(shift.start_time)}–{formatTimeCompact(shift.end_time)}
                </span>
                <Badge variant="outline" className="ml-1 text-[9px] h-4 px-1 capitalize border-blue-200 text-blue-600">
                  {shift.role}
                </Badge>
              </div>

              {/* Assign dropdown */}
              <Select onValueChange={val => handleAssign(shift.id, val)}>
                <SelectTrigger className="h-6 w-28 text-[10px] border-blue-200">
                  <SelectValue placeholder="Assign to…" />
                </SelectTrigger>
                <SelectContent>
                  {staff.filter(s => s.status === 'active').map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Remove */}
              <button
                onClick={() => handleDelete(shift.id)}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-red-100 text-blue-400 hover:text-red-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
