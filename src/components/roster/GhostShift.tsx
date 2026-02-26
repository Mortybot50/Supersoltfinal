/**
 * GhostShift — faded overlay of last week's shifts, shown in each cell.
 * Re-exports the logic so RosterCell can use it via a simple flag on ShiftBlock.
 * Also exports a standalone ghost block for the sidebar "copy last week" feature.
 */

import { RosterShift } from '@/types'
import { getRoleColors, getDaypart } from '@/stores/useRosterStore'
import { formatTimeCompact } from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'

interface GhostShiftProps {
  shift: RosterShift
  onClick?: () => void
}

/**
 * Standalone ghost shift block for use in sidebars or "copy week" previews.
 */
export function GhostShift({ shift, onClick }: GhostShiftProps) {
  const colors = getRoleColors(shift.role)

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'rounded border-dashed border text-[10px] px-1.5 py-0.5',
        'flex items-center gap-1 opacity-40 select-none',
        colors.bg, colors.border, colors.text,
        onClick && 'cursor-pointer hover:opacity-60 transition-opacity',
      )}
    >
      <Clock className="h-3 w-3 shrink-0" />
      <span>{formatTimeCompact(shift.start_time)}–{formatTimeCompact(shift.end_time)}</span>
    </div>
  )
}
