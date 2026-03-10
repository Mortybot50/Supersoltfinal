/**
 * RosterRow — a single staff member row with cells for each day in view.
 */

import { Staff, RosterShift } from '@/types'
import { RosterCell } from './RosterCell'
import { formatCurrency } from '@/lib/utils/formatters'
import { format, isSameDay, isWeekend, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { getRoleColors } from '@/stores/useRosterStore'

interface RosterRowProps {
  staff: Staff
  dates: Date[]
  shifts: RosterShift[]
  ghostShifts?: RosterShift[]
  weeklyHours: number
  compact?: boolean
  onAddShift?: (date: Date, staffId: string) => void
  onSelectShift?: (shift: RosterShift) => void
  onDeleteShift?: (shift: RosterShift) => void
}

export function RosterRow({
  staff,
  dates,
  shifts,
  ghostShifts = [],
  weeklyHours,
  compact = false,
  onAddShift,
  onSelectShift,
  onDeleteShift,
}: RosterRowProps) {
  const colors = getRoleColors(staff.role)
  const totalCost = shifts
    .filter(s => s.status !== 'cancelled')
    .reduce((sum, s) => sum + s.total_cost, 0)

  const isOvertime = weeklyHours > 38

  return (
    <>
      {/* Staff name column — sticky left */}
      <div
        className={cn(
          'sticky left-0 z-10 bg-white border-r border-b',
          'flex items-center gap-2 px-2 py-1.5',
          'min-h-[52px]',
          compact && 'min-h-[40px]',
        )}
      >
        {/* Avatar / role dot */}
        <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white', colors.dot)}>
          {staff.name.slice(0, 1).toUpperCase()}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate leading-tight">{staff.name}</div>
          <div className={cn('text-[10px] capitalize', colors.text, 'opacity-80 leading-tight')}>
            {staff.role}
          </div>
        </div>

        {/* Weekly hours */}
        <div className="text-right shrink-0">
          <div className={cn('text-[10px] font-medium tabular-nums', isOvertime && 'text-red-600')}>
            {weeklyHours.toFixed(1)}h
          </div>
          {totalCost > 0 && (
            <div className="text-[9px] text-gray-400 tabular-nums">{formatCurrency(totalCost)}</div>
          )}
        </div>
      </div>

      {/* Day cells */}
      {dates.map(date => {
        const dayShifts = shifts.filter(s => {
          const d = s.date instanceof Date ? s.date : new Date(s.date)
          return isSameDay(d, date) && s.staff_id === staff.id && s.status !== 'cancelled'
        })
        const dayGhosts = ghostShifts.filter(s => {
          const d = s.date instanceof Date ? s.date : new Date(s.date)
          return isSameDay(d, date) && s.staff_id === staff.id
        })

        return (
          <RosterCell
            key={format(date, 'yyyy-MM-dd')}
            date={date}
            staffId={staff.id}
            shifts={dayShifts}
            ghostShifts={dayGhosts}
            isToday={isToday(date)}
            isWeekend={isWeekend(date)}
            compact={compact}
            onAddShift={onAddShift}
            onSelectShift={onSelectShift}
            onDeleteShift={onDeleteShift}
          />
        )
      })}
    </>
  )
}
