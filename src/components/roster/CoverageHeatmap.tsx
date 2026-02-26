/**
 * CoverageHeatmap — under/over-staffed visual indicator per daypart per day.
 * Renders a colored band below each column header showing coverage gaps.
 */

import { useMemo } from 'react'
import { RosterShift } from '@/types'
import { getDaypart, DAYPARTS } from './DayPartBands'
import { isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'

// Minimum expected staff per daypart (could be configurable later)
const MIN_STAFF: Record<string, number> = {
  am: 2,
  lunch: 3,
  pm: 2,
  close: 2,
}

interface CoverageHeatmapProps {
  date: Date
  shifts: RosterShift[]
}

export function CoverageHeatmap({ date, shifts }: CoverageHeatmapProps) {
  const coverage = useMemo(() => {
    const dayShifts = shifts.filter(s => {
      if (s.status === 'cancelled' || s.is_open_shift) return false
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      return isSameDay(d, date)
    })

    return DAYPARTS.map(dp => {
      const count = dayShifts.filter(s => getDaypart(s.start_time) === dp.key).length
      const min = MIN_STAFF[dp.key] || 2
      const level = count === 0 ? 'none' : count < min ? 'under' : count > min * 2 ? 'over' : 'ok'
      return { ...dp, count, min, level }
    })
  }, [date, shifts])

  return (
    <div className="flex gap-0.5 px-1 py-0.5">
      {coverage.map(dp => (
        <div
          key={dp.key}
          className={cn(
            'flex-1 h-1 rounded-full transition-colors',
            dp.level === 'none' && 'bg-gray-200',
            dp.level === 'under' && 'bg-red-400',
            dp.level === 'ok' && 'bg-green-400',
            dp.level === 'over' && 'bg-yellow-400',
          )}
          title={`${dp.label}: ${dp.count} staff (min ${dp.min}) — ${dp.level}`}
        />
      ))}
    </div>
  )
}

/**
 * Full coverage heatmap legend for the cost bar area.
 */
export function CoverageHeatmapLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-gray-400">
      <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-400" /><span>Under</span></div>
      <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-400" /><span>Good</span></div>
      <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-yellow-400" /><span>Over</span></div>
    </div>
  )
}
