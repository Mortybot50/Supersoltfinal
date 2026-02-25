/**
 * DayPartBands — renders subtle background color bands for AM/Lunch/PM/Close
 * time zones inside a roster cell.
 */

import { cn } from '@/lib/utils'

export const DAYPARTS = [
  { key: 'am',    label: 'AM',    range: '6am–11am',  color: 'bg-sky-50',     border: 'border-sky-100' },
  { key: 'lunch', label: 'Lunch', range: '11am–2pm',  color: 'bg-amber-50',   border: 'border-amber-100' },
  { key: 'pm',    label: 'PM',    range: '2pm–6pm',   color: 'bg-emerald-50', border: 'border-emerald-100' },
  { key: 'close', label: 'Close', range: '6pm–10pm',  color: 'bg-indigo-50',  border: 'border-indigo-100' },
] as const

export type Daypart = typeof DAYPARTS[number]['key']

export function getDaypart(startTime: string): Daypart {
  const [h] = startTime.split(':').map(Number)
  if (h >= 6 && h < 11) return 'am'
  if (h >= 11 && h < 14) return 'lunch'
  if (h >= 14 && h < 18) return 'pm'
  return 'close'
}

export function getDaypartColor(dp: Daypart) {
  return DAYPARTS.find(d => d.key === dp) ?? DAYPARTS[0]
}

interface DayPartBandsProps {
  className?: string
}

/**
 * Renders four stacked background bands.
 * Meant to sit as an absolute-positioned background inside a RosterCell.
 */
export function DayPartBands({ className }: DayPartBandsProps) {
  return (
    <div className={cn('absolute inset-0 flex flex-col pointer-events-none select-none', className)}>
      {DAYPARTS.map(dp => (
        <div
          key={dp.key}
          className={cn('flex-1 border-b last:border-b-0', dp.color, dp.border)}
          title={`${dp.label} ${dp.range}`}
        />
      ))}
    </div>
  )
}
