/**
 * ShiftBlock — draggable shift pill rendered inside a RosterCell.
 * Shows role color, times, cost, and penalty indicator.
 * Commit 2: draggable via @dnd-kit/core useDraggable.
 */

import { useDraggable } from '@dnd-kit/core'
import { RosterShift } from '@/types'
import { getRoleColors, getDaypart } from '@/stores/useRosterStore'
import { getDaypartColor } from './DayPartBands'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatTimeCompact } from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import { X, GripVertical } from 'lucide-react'
import { ComplianceIcon } from './ComplianceIcon'
import { TooltipProvider } from '@/components/ui/tooltip'

export const DRAGGABLE_SHIFT_TYPE = 'shift-block'

interface ShiftBlockProps {
  shift: RosterShift
  isGhost?: boolean
  onSelect?: (shift: RosterShift) => void
  onDelete?: (shift: RosterShift) => void
}

export function ShiftBlock({
  shift,
  isGhost = false,
  onSelect,
  onDelete,
}: ShiftBlockProps) {
  const roleColors = getRoleColors(shift.role)
  const daypart = getDaypart(shift.start_time)
  const dpColor = getDaypartColor(daypart)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    data: { type: DRAGGABLE_SHIFT_TYPE, shift },
    disabled: isGhost,
  })

  const isWeekend = (() => {
    const d = shift.date instanceof Date ? shift.date : new Date(shift.date)
    const day = d.getDay()
    return day === 0 || day === 6
  })()

  const isEvening = (() => {
    const [h] = shift.end_time.split(':').map(Number)
    return h >= 19
  })()

  const isPublicHoliday = shift.penalty_type === 'public_holiday'

  return (
    <TooltipProvider>
    <div
      ref={setNodeRef}
      className={cn(
        'group relative rounded border text-xs select-none',
        'transition-all duration-100',
        'px-1.5 py-1 min-h-[36px]',
        roleColors.bg,
        roleColors.border,
        roleColors.text,
        isGhost && 'opacity-30 border-dashed pointer-events-none',
        isDragging && 'opacity-40 shadow-lg',
        isWeekend && !isGhost && 'roster-weekend-shift',
        isEvening && !isGhost && 'brightness-95',
        isPublicHoliday && !isGhost && 'border-amber-400 border-2',
        shift.status === 'scheduled' && !isGhost && 'border-dashed opacity-90',
        'hover:shadow-sm hover:brightness-95',
      )}
    >
      {/* Daypart accent strip */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-0.5 rounded-l', dpColor.color)} />

      {/* Drag handle — visible on hover */}
      {!isGhost && (
        <div
          {...listeners}
          {...attributes}
          className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <GripVertical className="h-3 w-3 text-current opacity-40" />
        </div>
      )}

      {/* Content — click to select */}
      <div
        className="pl-1 cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(shift)}
        onKeyDown={e => e.key === 'Enter' && onSelect?.(shift)}
      >
        <div className="flex items-center gap-1">
          <span className="font-medium truncate leading-tight">
            {formatTimeCompact(shift.start_time)}–{formatTimeCompact(shift.end_time)}
          </span>
          <ComplianceIcon shiftId={shift.id} />
          {shift.penalty_type && shift.penalty_type !== 'none' && shift.penalty_multiplier && shift.penalty_multiplier > 1 && (
            <span className="ml-auto text-[10px] font-medium opacity-70 shrink-0">
              {(shift.penalty_multiplier * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5 gap-1">
          <span className="opacity-70 truncate">{shift.total_hours.toFixed(1)}h</span>
          {shift.total_cost > 0 && (
            <span className="opacity-70 text-[10px] shrink-0">{formatCurrency(shift.total_cost)}</span>
          )}
        </div>
      </div>

      {/* Delete button */}
      {onDelete && !isGhost && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(shift) }}
          className={cn(
            'absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white',
            'items-center justify-center hidden group-hover:flex',
            'hover:bg-red-600 transition-colors shadow-sm z-10',
          )}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
    </TooltipProvider>
  )
}
