/**
 * StaffCard — draggable staff card in the StaffSidebar.
 * Commit 2: drag to grid to create a new shift.
 */

import { useDraggable } from '@dnd-kit/core'
import { Staff } from '@/types'
import { getRoleColors } from '@/stores/useRosterStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

export const DRAGGABLE_STAFF_TYPE = 'staff-card'

interface StaffCardProps {
  staff: Staff
  weeklyHours: number
  shiftCount: number
}

export function StaffCard({ staff, weeklyHours, shiftCount }: StaffCardProps) {
  const colors = getRoleColors(staff.role)
  const isOvertime = weeklyHours > 38

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `staff-${staff.id}`,
    data: { type: DRAGGABLE_STAFF_TYPE, staff },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2 bg-white',
        'cursor-grab active:cursor-grabbing select-none',
        'transition-all duration-100',
        isDragging && 'opacity-50 shadow-lg rotate-1 scale-105 z-50',
        'hover:shadow-sm hover:border-gray-300',
      )}
      {...attributes}
      {...listeners}
    >
      {/* Drag handle */}
      <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />

      {/* Avatar */}
      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white', colors.dot)}>
        {staff.name.slice(0, 1).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate leading-tight">{staff.name}</div>
        <div className={cn('text-[10px] capitalize leading-tight', colors.text)}>
          {staff.role}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right shrink-0">
        <div className={cn('text-xs font-medium tabular-nums', isOvertime ? 'text-red-500' : 'text-gray-600')}>
          {weeklyHours.toFixed(1)}h
        </div>
        {shiftCount > 0 && (
          <div className="text-[10px] text-gray-400">{shiftCount}×</div>
        )}
      </div>
    </div>
  )
}
