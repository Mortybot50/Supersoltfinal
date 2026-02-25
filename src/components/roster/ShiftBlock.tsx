/**
 * ShiftBlock — draggable shift pill rendered inside a RosterCell.
 * Shows role color, times, cost, and penalty indicator.
 * Commit 1: static. Commit 2: becomes draggable via @dnd-kit.
 */

import { RosterShift } from '@/types'
import { getRoleColors, getDaypart } from '@/stores/useRosterStore'
import { getDaypartColor } from './DayPartBands'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatTimeCompact } from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import { X, AlertTriangle } from 'lucide-react'

interface ShiftBlockProps {
  shift: RosterShift
  isGhost?: boolean
  onSelect?: (shift: RosterShift) => void
  onDelete?: (shift: RosterShift) => void
  /** injected by DnD wrapper in commit 2 */
  dragHandleProps?: Record<string, unknown>
  isDragging?: boolean
}

export function ShiftBlock({
  shift,
  isGhost = false,
  onSelect,
  onDelete,
  isDragging = false,
}: ShiftBlockProps) {
  const roleColors = getRoleColors(shift.role)
  const daypart = getDaypart(shift.start_time)
  const dpColor = getDaypartColor(daypart)

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
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(shift)}
      onKeyDown={e => e.key === 'Enter' && onSelect?.(shift)}
      className={cn(
        'group relative rounded border text-xs cursor-pointer select-none',
        'transition-all duration-100',
        'px-1.5 py-1 min-h-[36px]',
        roleColors.bg,
        roleColors.border,
        roleColors.text,
        isGhost && 'opacity-30 border-dashed pointer-events-none',
        isDragging && 'opacity-50 shadow-lg rotate-1 scale-105 z-50',
        // weekend stripe overlay
        isWeekend && !isGhost && 'roster-weekend-shift',
        // evening: darker role color
        isEvening && !isGhost && 'brightness-95',
        // public holiday: gold border
        isPublicHoliday && !isGhost && 'border-amber-400 border-2',
        shift.status === 'scheduled' && !isGhost && 'border-dashed opacity-90',
        'hover:shadow-sm hover:brightness-95',
        'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400',
      )}
    >
      {/* Daypart accent strip */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-0.5 rounded-l', dpColor.color.replace('bg-', 'bg-'))} />

      {/* Content */}
      <div className="pl-1.5">
        <div className="flex items-center gap-1">
          <span className="font-medium truncate leading-tight">
            {formatTimeCompact(shift.start_time)}–{formatTimeCompact(shift.end_time)}
          </span>

          {/* Compliance warning dot */}
          {shift.warnings && shift.warnings.length > 0 && (
            <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
          )}

          {/* Penalty badge */}
          {shift.penalty_type && shift.penalty_type !== 'none' && (
            <span className="ml-auto text-[10px] font-medium opacity-70 shrink-0">
              {shift.penalty_multiplier !== undefined && shift.penalty_multiplier > 1
                ? `${(shift.penalty_multiplier * 100).toFixed(0)}%`
                : ''}
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

      {/* Delete button (hover) */}
      {onDelete && !isGhost && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(shift) }}
          className={cn(
            'absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white',
            'items-center justify-center hidden group-hover:flex',
            'hover:bg-red-600 transition-colors shadow-sm',
          )}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}
