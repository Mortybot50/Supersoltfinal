/**
 * RosterCell — a single day cell for one staff member.
 * Supports: viewMode (staff/compact/stats), spotlight dimming.
 */

import { useDroppable } from '@dnd-kit/core'
import { RosterShift } from '@/types'
import { ShiftBlock } from './ShiftBlock'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { isPublicHoliday } from '@/lib/utils/rosterCalculations'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils/formatters'

export function cellDropId(staffId: string, date: Date) {
  return `cell::${staffId}::${format(date, 'yyyy-MM-dd')}`
}

interface RosterCellProps {
  date: Date
  staffId: string
  shifts: RosterShift[]
  ghostShifts?: RosterShift[]
  isToday?: boolean
  isWeekend?: boolean
  compact?: boolean
  viewMode?: 'staff' | 'compact' | 'stats'
  dimmedIds?: Set<string>
  onAddShift?: (date: Date, staffId: string) => void
  onSelectShift?: (shift: RosterShift) => void
  onDeleteShift?: (shift: RosterShift) => void
}

export function RosterCell({
  date,
  staffId,
  shifts,
  ghostShifts = [],
  isToday = false,
  isWeekend = false,
  compact = false,
  viewMode = 'staff',
  dimmedIds = new Set(),
  onAddShift,
  onSelectShift,
  onDeleteShift,
}: RosterCellProps) {
  const isHoliday = isPublicHoliday(date)
  const dropId = cellDropId(staffId, date)

  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { staffId, date },
  })

  const totalHours = shifts.reduce((s, sh) => s + sh.total_hours, 0)
  const totalCost = shifts.reduce((s, sh) => s + sh.total_cost, 0)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative group min-h-[52px] border-r border-b p-1 transition-colors',
        isToday && 'bg-blue-50/50',
        isWeekend && !isToday && 'bg-gray-50/80',
        isHoliday && 'bg-amber-50/60',
        isOver && 'bg-teal-50 ring-2 ring-inset ring-teal-400',
        compact && 'min-h-[40px]',
        'hover:bg-gray-50/40',
      )}
      onClick={e => {
        if ((e.target as HTMLElement).closest('[role="button"]')) return
        onAddShift?.(date, staffId)
      }}
    >
      {/* Ghost shifts (last week, faded) */}
      {ghostShifts.map(gs => (
        <ShiftBlock
          key={`ghost-${gs.id}`}
          shift={gs}
          isGhost
        />
      ))}

      {viewMode === 'stats' ? (
        /* ── Stats view: show totals instead of shift blocks ── */
        shifts.length > 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-0.5 py-1">
            <span className="text-xs font-semibold tabular-nums">{totalHours.toFixed(1)}h</span>
            {totalCost > 0 && (
              <span className="text-[10px] text-gray-500 tabular-nums">{formatCurrency(totalCost)}</span>
            )}
            <span className="text-[9px] text-gray-400">{shifts.length} shift{shifts.length !== 1 ? 's' : ''}</span>
          </div>
        ) : null
      ) : (
        /* ── Staff / Compact view: render shift blocks ── */
        <div className="flex flex-col gap-0.5">
          {shifts.map(shift => (
            <ShiftBlock
              key={shift.id}
              shift={shift}
              dimmed={dimmedIds.has(shift.id)}
              onSelect={onSelectShift}
              onDelete={onDeleteShift}
            />
          ))}
        </div>
      )}

      {/* Hours total (multiple shifts, staff view only) */}
      {viewMode !== 'stats' && shifts.length > 1 && (
        <div className="text-[10px] text-gray-500 text-right mt-0.5 pr-0.5">
          {totalHours.toFixed(1)}h
        </div>
      )}

      {/* Drop indicator overlay */}
      {isOver && (
        <div className="absolute inset-0 border-2 border-teal-400 rounded pointer-events-none flex items-center justify-center">
          <span className="text-[10px] font-medium text-teal-600 bg-white/80 px-1 rounded">Drop here</span>
        </div>
      )}

      {/* Add shift button */}
      {onAddShift && (
        <button
          onClick={e => { e.stopPropagation(); onAddShift(date, staffId) }}
          className={cn(
            'absolute bottom-0.5 right-0.5 h-4 w-4 rounded',
            'bg-gray-200 text-gray-500 items-center justify-center',
            'hidden group-hover:flex hover:bg-gray-300 transition-colors',
          )}
          title="Add shift"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}

      {/* Holiday marker */}
      {isHoliday && (
        <div className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" title="Public holiday" />
      )}
    </div>
  )
}
