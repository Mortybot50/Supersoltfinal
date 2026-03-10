/**
 * RosterGrid — main grid container.
 * Renders role-grouped staff rows × date columns.
 * Supports: groupBy (role/employment_type/none), spotlightFilter, viewMode (staff/compact/stats).
 */

import { useMemo } from 'react'

import { Staff, RosterShift } from '@/types'
import { useRosterStore } from '@/stores/useRosterStore'
import { RosterRow } from './RosterRow'
import { RoleGroupHeader } from './RoleGroupHeader'
import { DayView } from './DayView'

import { format, isToday, isWeekend, isSameDay } from 'date-fns'
import { getWeekDates, getFortnightDates } from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import { CoverageHeatmap } from './CoverageHeatmap'
import { SalesForecastOverlay, PrepLoadBadge } from './SalesForecastOverlay'
import { TooltipProvider } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/utils/formatters'

/** Compute which shift IDs should be dimmed for the active spotlight filter. */
function computeDimmedIds(
  spotlightFilter: string | null,
  shifts: RosterShift[],
  weeklyHours: Record<string, number>,
): Set<string> {
  if (!spotlightFilter) return new Set()
  return new Set(
    shifts
      .filter(shift => {
        switch (spotlightFilter) {
          case 'validation_errors': return !shift.warnings || shift.warnings.length === 0
          case 'overtime': return (weeklyHours[shift.staff_id] || 0) <= 38
          case 'open_vacant': return !shift.is_open_shift
          case 'pending_acceptance': return shift.status !== 'confirmed'
          case 'draft_only': return shift.status !== 'scheduled'
          default: return false
        }
      })
      .map(s => s.id)
  )
}

interface RosterGridProps {
  onAddShift?: (date: Date, staffId: string) => void
  onSelectShift?: (shift: RosterShift) => void
  onDeleteShift?: (shift: RosterShift) => void
}

export function RosterGrid({
  onAddShift,
  onSelectShift,
  onDeleteShift,
}: RosterGridProps) {
  const {
    view, selectedDate,
    shifts, ghostShifts, staff,
    roleFilter, searchQuery,
    expandedRoles, toggleRole,
    spotlightFilter, groupBy, viewMode,
  } = useRosterStore()

  const dates = useMemo(() => {
    if (view === 'fortnight') return getFortnightDates(selectedDate)
    if (view === 'day') return [selectedDate]
    return getWeekDates(selectedDate)
  }, [view, selectedDate])

  const filteredStaff = useMemo(() => {
    let s = staff.filter(m => m.status === 'active')
    if (roleFilter) s = s.filter(m => m.role.toLowerCase() === roleFilter.toLowerCase())
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      s = s.filter(m => m.name.toLowerCase().includes(q))
    }
    return s
  }, [staff, roleFilter, searchQuery])

  const weeklyHours = useMemo(() => {
    const map: Record<string, number> = {}
    shifts
      .filter(s => s.status !== 'cancelled' && !s.is_open_shift)
      .forEach(s => { map[s.staff_id] = (map[s.staff_id] || 0) + s.total_hours })
    return map
  }, [shifts])

  const dimmedIds = useMemo(
    () => computeDimmedIds(spotlightFilter, shifts, weeklyHours),
    [spotlightFilter, shifts, weeklyHours],
  )

  // ── Grouping ───────────────────────────────────────────────────────────────

  const roleGroups = useMemo((): [string, Staff[]][] => {
    if (groupBy === 'none') {
      const sorted = [...filteredStaff].sort((a, b) => a.name.localeCompare(b.name))
      return [['__all__', sorted]]
    }
    const groups: Record<string, Staff[]> = {}
    filteredStaff.forEach(s => {
      const key = groupBy === 'employment_type'
        ? (s.employment_type || 'casual')
        : (s.role || 'crew')
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredStaff, groupBy])

  // ── Layout ────────────────────────────────────────────────────────────────

  const compact = view === 'fortnight' || viewMode === 'compact'
  const colCount = dates.length

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `180px repeat(${colCount}, minmax(${compact ? '60px' : '100px'}, 1fr))`,
  }

  // Render DayView for day mode
  if (view === 'day') {
    return (
      <DayView
        onAddShift={onAddShift}
        onSelectShift={onSelectShift}
        onDeleteShift={onDeleteShift}
      />
    )
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-auto relative">
        <style>{`
          .roster-weekend-shift {
            background-image: repeating-linear-gradient(
              135deg,
              transparent,
              transparent 4px,
              rgba(0,0,0,0.04) 4px,
              rgba(0,0,0,0.04) 8px
            );
          }
        `}</style>

        <div style={gridStyle} className="min-w-max">

          {/* ── Column headers ── */}
          <div className="sticky top-0 left-0 z-30 bg-white border-r border-b px-2 py-1.5 flex items-end">
            <span className="text-xs text-gray-400 font-medium">Staff</span>
          </div>
          {dates.map(date => {
            const today = isToday(date)
            const weekend = isWeekend(date)
            return (
              <div
                key={format(date, 'yyyy-MM-dd')}
                className={cn(
                  'sticky top-0 z-20 border-r border-b px-1 py-1.5 text-center',
                  today ? 'bg-blue-50' : weekend ? 'bg-gray-50' : 'bg-white',
                )}
              >
                <div className={cn('text-[10px] font-medium uppercase tracking-wide', today ? 'text-blue-600' : 'text-gray-500')}>
                  {format(date, 'EEE')}
                </div>
                <div className={cn(
                  'text-sm font-bold leading-tight',
                  today
                    ? 'text-blue-600 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center mx-auto'
                    : 'text-gray-800'
                )}>
                  {format(date, 'd')}
                </div>
                {!compact && (
                  <div className="text-[9px] text-gray-400">{format(date, 'MMM')}</div>
                )}
                {/* Coverage heatmap strip */}
                <CoverageHeatmap date={date} shifts={shifts} />
                {/* Prep load badge */}
                <div className="flex justify-center mt-0.5">
                  <PrepLoadBadge date={date} dates={dates} />
                </div>
              </div>
            )
          })}

          {/* ── Role groups + rows ── */}
          {roleGroups.map(([groupKey, groupStaff]) => {
            const isNoGrouping = groupKey === '__all__'
            const isExpanded = isNoGrouping || expandedRoles.has(groupKey)
            const groupShifts = shifts.filter(s => groupStaff.some(m => m.id === s.staff_id))

            return (
              <div key={groupKey} className="contents">
                {!isNoGrouping && (
                  <div style={{ gridColumn: `1 / span ${colCount + 1}` }}>
                    <RoleGroupHeader
                      role={groupKey}
                      staffCount={groupStaff.length}
                      shifts={groupShifts}
                      isExpanded={isExpanded}
                      onToggle={() => toggleRole(groupKey)}
                      colCount={colCount}
                    />
                  </div>
                )}
                {isExpanded && groupStaff.map(member => (
                  <RosterRow
                    key={member.id}
                    staff={member}
                    dates={dates}
                    shifts={shifts.filter(s => s.staff_id === member.id)}
                    ghostShifts={ghostShifts.filter(s => s.staff_id === member.id)}
                    weeklyHours={weeklyHours[member.id] || 0}
                    compact={compact}
                    viewMode={viewMode}
                    dimmedIds={dimmedIds}
                    onAddShift={onAddShift}
                    onSelectShift={onSelectShift}
                    onDeleteShift={onDeleteShift}
                  />
                ))}
              </div>
            )
          })}

          {/* Empty state */}
          {filteredStaff.length === 0 && (
            <div
              style={{ gridColumn: `1 / span ${colCount + 1}` }}
              className="py-16 text-center text-gray-400 text-sm"
            >
              {searchQuery
                ? `No staff matching "${searchQuery}"`
                : 'No active staff. Add staff in the People module.'}
            </div>
          )}

          {/* ── Day totals footer ── */}
          <div className="sticky bottom-0 left-0 z-20 bg-gray-50 border-t border-r px-2 py-1 flex items-center">
            <span className="text-xs font-medium text-gray-500">Total</span>
          </div>
          {dates.map(date => {
            const dayShifts = shifts.filter(s => {
              const d = s.date instanceof Date ? s.date : new Date(s.date)
              return isSameDay(d, date) && s.status !== 'cancelled'
            })
            const hours = dayShifts.reduce((s, sh) => s + sh.total_hours, 0)
            const cost = dayShifts.reduce((s, sh) => s + sh.total_cost, 0)
            return (
              <div
                key={`footer-${format(date, 'yyyy-MM-dd')}`}
                className="sticky bottom-0 z-20 bg-gray-50 border-t border-r px-1 py-1 text-center"
              >
                <div className="text-xs font-medium tabular-nums">{hours.toFixed(1)}h</div>
                {cost > 0 && (
                  <div className="text-[10px] text-gray-500 tabular-nums">
                    {formatCurrency(cost)}
                  </div>
                )}
              </div>
            )
          })}

        </div>
      </div>


    </TooltipProvider>
  )
}
