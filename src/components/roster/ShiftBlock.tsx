/**
 * ShiftBlock — draggable shift pill rendered inside a RosterCell.
 * Shows role color, times, cost, and penalty indicator.
 * Supports: drag-and-drop, inline time editing, context menu, spotlight dimming.
 */

import { useState, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { RosterShift } from '@/types'
import { getRoleColors, getDaypart, useRosterStore } from '@/stores/useRosterStore'
import { getDaypartColor } from './DayPartBands'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatTimeCompact } from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'
import { ComplianceIcon } from './ComplianceIcon'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ShiftContextMenu } from './ShiftContextMenu'

export const DRAGGABLE_SHIFT_TYPE = 'shift-block'

interface ShiftBlockProps {
  shift: RosterShift
  isGhost?: boolean
  dimmed?: boolean
  onSelect?: (shift: RosterShift) => void
  /** @deprecated Delete is handled by the context menu. Kept for backward compat. */
  onDelete?: (shift: RosterShift) => void
}

export function ShiftBlock({
  shift,
  isGhost = false,
  dimmed = false,
  onSelect,
  onDelete,
}: ShiftBlockProps) {
  const { updateShift, selectShift } = useRosterStore()

  const roleColors = getRoleColors(shift.role)
  const daypart = getDaypart(shift.start_time)
  const dpColor = getDaypartColor(daypart)

  // ── Inline time editing ──────────────────────────────────────────────────
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [editStart, setEditStart] = useState(shift.start_time)
  const [editEnd, setEditEnd] = useState(shift.end_time)
  const startRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLInputElement>(null)

  const commitTimeEdit = () => {
    if (editStart !== shift.start_time || editEnd !== shift.end_time) {
      updateShift(shift.id, { start_time: editStart, end_time: editEnd })
    }
    setIsEditingTime(false)
  }

  const cancelTimeEdit = () => {
    setEditStart(shift.start_time)
    setEditEnd(shift.end_time)
    setIsEditingTime(false)
  }

  const handleTimeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitTimeEdit() }
    if (e.key === 'Escape') { e.preventDefault(); cancelTimeEdit() }
  }

  // ── Drag ────────────────────────────────────────────────────────────────
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    data: { type: DRAGGABLE_SHIFT_TYPE, shift },
    disabled: isGhost || isEditingTime,
  })

  // ── Visual flags ─────────────────────────────────────────────────────────
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

  // ── See costs handler ────────────────────────────────────────────────────
  const handleSeeCosts = () => {
    selectShift(shift.id)
    onSelect?.(shift)
  }

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
          dimmed && !isGhost && 'opacity-40',
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

        {/* Content */}
        <div className="pl-1">
          {isEditingTime ? (
            /* ── Inline time editor ──────────────────────────────────── */
            <div
              className="flex items-center gap-0.5"
              onClick={e => e.stopPropagation()}
              onKeyDown={handleTimeKeyDown}
            >
              <input
                ref={startRef}
                type="time"
                value={editStart}
                onChange={e => setEditStart(e.target.value)}
                onBlur={() => { if (document.activeElement !== endRef.current) commitTimeEdit() }}
                className="w-[72px] text-[10px] border rounded px-0.5 py-0 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                autoFocus
              />
              <span className="opacity-50 text-[10px]">–</span>
              <input
                ref={endRef}
                type="time"
                value={editEnd}
                onChange={e => setEditEnd(e.target.value)}
                onBlur={() => { if (document.activeElement !== startRef.current) commitTimeEdit() }}
                className="w-[72px] text-[10px] border rounded px-0.5 py-0 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          ) : (
            /* ── Normal display ─────────────────────────────────────── */
            <div
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(shift)}
              onKeyDown={e => e.key === 'Enter' && onSelect?.(shift)}
            >
              <div className="flex items-center gap-1">
                <span
                  className="font-medium truncate leading-tight hover:underline"
                  onClick={e => {
                    e.stopPropagation()
                    setIsEditingTime(true)
                    setEditStart(shift.start_time)
                    setEditEnd(shift.end_time)
                  }}
                  title="Click to edit times"
                >
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
          )}
        </div>

        {/* Context menu (three-dot) — handles delete with confirmation */}
        {!isGhost && (
          <ShiftContextMenu shift={shift} onSeeCosts={handleSeeCosts} />
        )}
      </div>
    </TooltipProvider>
  )
}
