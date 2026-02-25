/**
 * RosterCell — a single day cell for one staff member.
 * Commit 1: click-to-add, shows shift blocks.
 * Commit 2: becomes a drop zone via @dnd-kit.
 */

import { RosterShift } from '@/types'
import { ShiftBlock } from './ShiftBlock'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { isPublicHoliday } from '@/lib/utils/rosterCalculations'

interface RosterCellProps {
  date: Date
  staffId: string
  shifts: RosterShift[]
  ghostShifts?: RosterShift[]
  isToday?: boolean
  isWeekend?: boolean
  compact?: boolean
  onAddShift?: (date: Date, staffId: string) => void
  onSelectShift?: (shift: RosterShift) => void
  onDeleteShift?: (shift: RosterShift) => void
  /** injected by DnD in commit 2 */
  isOver?: boolean
}

export function RosterCell({
  date,
  staffId,
  shifts,
  ghostShifts = [],
  isToday = false,
  isWeekend = false,
  compact = false,
  onAddShift,
  onSelectShift,
  onDeleteShift,
  isOver = false,
}: RosterCellProps) {
  const isHoliday = isPublicHoliday(date)
  const totalHours = shifts.reduce((s, sh) => s + sh.total_hours, 0)

  return (
    <div
      className={cn(
        'relative group min-h-[52px] border-r border-b p-1 transition-colors',
        isToday && 'bg-blue-50/50',
        isWeekend && !isToday && 'bg-gray-50/80',
        isHoliday && 'bg-amber-50/60',
        isOver && 'bg-teal-50 ring-2 ring-inset ring-teal-300',
        compact && 'min-h-[40px]',
        'hover:bg-gray-50/60',
      )}
      onClick={e => {
        // Only fire if clicking the cell background (not a shift block)
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

      {/* Actual shifts */}
      <div className="flex flex-col gap-0.5">
        {shifts.map(shift => (
          <ShiftBlock
            key={shift.id}
            shift={shift}
            onSelect={onSelectShift}
            onDelete={onDeleteShift}
          />
        ))}
      </div>

      {/* Hours total (when multiple shifts) */}
      {shifts.length > 1 && (
        <div className="text-[10px] text-gray-500 text-right mt-0.5 pr-0.5">
          {totalHours.toFixed(1)}h
        </div>
      )}

      {/* Add shift button (hover) */}
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
