/**
 * RosterGrid — main grid container.
 * Renders role-grouped staff rows × date columns.
 * Commit 2: wrapped with DndContext — shifts drag between cells,
 *            staff cards drag from sidebar to create shifts.
 */

import { useMemo, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { useState } from 'react'
import { Staff, RosterShift } from '@/types'
import { useRosterStore } from '@/stores/useRosterStore'
import { RosterRow } from './RosterRow'
import { RoleGroupHeader } from './RoleGroupHeader'
import { ShiftBlock, DRAGGABLE_SHIFT_TYPE } from './ShiftBlock'
import { DRAGGABLE_STAFF_TYPE } from './StaffCard'
import { format, isToday, isWeekend, isSameDay, parse } from 'date-fns'
import { getWeekDates, getFortnightDates, calculateShiftCostBreakdown } from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import { CoverageHeatmap } from './CoverageHeatmap'
import { TooltipProvider } from '@/components/ui/tooltip'

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
    moveShift, addShift,
  } = useRosterStore()

  const [draggingShift, setDraggingShift] = useState<RosterShift | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

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

  const roleGroups = useMemo(() => {
    const groups: Record<string, Staff[]> = {}
    filteredStaff.forEach(s => {
      const r = s.role || 'crew'
      if (!groups[r]) groups[r] = []
      groups[r].push(s)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredStaff])

  const weeklyHours = useMemo(() => {
    const map: Record<string, number> = {}
    shifts
      .filter(s => s.status !== 'cancelled' && !s.is_open_shift)
      .forEach(s => { map[s.staff_id] = (map[s.staff_id] || 0) + s.total_hours })
    return map
  }, [shifts])

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current
    if (data?.type === DRAGGABLE_SHIFT_TYPE) {
      setDraggingShift(data.shift)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingShift(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // Droppable cells have ids like "cell::staffId::yyyy-MM-dd"
    if (!over.id || !String(over.id).startsWith('cell::')) return

    const [, targetStaffId, targetDateStr] = String(over.id).split('::')
    const targetDate = parse(targetDateStr, 'yyyy-MM-dd', new Date())
    const targetStaff = staff.find(s => s.id === targetStaffId)

    if (activeData?.type === DRAGGABLE_SHIFT_TYPE) {
      // Moving an existing shift
      const shift: RosterShift = activeData.shift
      if (shift.staff_id === targetStaffId && isSameDay(shift.date instanceof Date ? shift.date : new Date(shift.date), targetDate)) {
        return // No change
      }
      moveShift(shift.id, targetStaffId, targetDate)
    } else if (activeData?.type === DRAGGABLE_STAFF_TYPE && targetStaff) {
      // Dragging a staff card → create a new shift with default 9–5
      const staffMember = activeData.staff as Staff
      const breakdown = calculateShiftCostBreakdown(
        '09:00', '17:00', 30,
        staffMember.hourly_rate,
        targetStaff.venue_id || '',
        targetDate,
        staffMember.employment_type || 'casual',
      )
      addShift({
        staff_id: staffMember.id,
        staff_name: staffMember.name,
        date: targetDate,
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 30,
        role: staffMember.role,
        total_hours: breakdown.base_hours,
        base_cost: breakdown.base_cost_cents,
        penalty_cost: breakdown.penalty_cost_cents,
        total_cost: breakdown.total_cost_cents,
        penalty_type: breakdown.penalty_type as RosterShift['penalty_type'] || 'none',
        penalty_multiplier: breakdown.penalty_multiplier,
      })
    }
  }, [staff, moveShift, addShift])

  // ── Layout ────────────────────────────────────────────────────────────────

  const compact = view === 'fortnight'
  const colCount = dates.length

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `180px repeat(${colCount}, minmax(${compact ? '60px' : '100px'}, 1fr))`,
  }

  return (
    <TooltipProvider>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
              </div>
            )
          })}

          {/* ── Role groups + rows ── */}
          {roleGroups.map(([role, roleStaff]) => {
            const isExpanded = expandedRoles.has(role)
            const roleShifts = shifts.filter(s => roleStaff.some(m => m.id === s.staff_id))

            return (
              <div key={role} className="contents">
                <div style={{ gridColumn: `1 / span ${colCount + 1}` }}>
                  <RoleGroupHeader
                    role={role}
                    staffCount={roleStaff.length}
                    shifts={roleShifts}
                    isExpanded={isExpanded}
                    onToggle={() => toggleRole(role)}
                    colCount={colCount}
                  />
                </div>
                {isExpanded && roleStaff.map(member => (
                  <RosterRow
                    key={member.id}
                    staff={member}
                    dates={dates}
                    shifts={shifts.filter(s => s.staff_id === member.id)}
                    ghostShifts={ghostShifts.filter(s => s.staff_id === member.id)}
                    weeklyHours={weeklyHours[member.id] || 0}
                    compact={compact}
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
                    ${(cost / 100).toFixed(0)}
                  </div>
                )}
              </div>
            )
          })}

        </div>
      </div>

      {/* Drag overlay — shows a ghost of the dragging shift */}
      <DragOverlay>
        {draggingShift && (
          <div className="w-[120px] pointer-events-none rotate-2 shadow-xl opacity-90">
            <ShiftBlock shift={draggingShift} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
    </TooltipProvider>
  )
}
