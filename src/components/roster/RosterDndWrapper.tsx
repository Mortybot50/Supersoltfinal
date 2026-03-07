/**
 * RosterDndWrapper — provides DndContext that wraps both
 * StaffSidebar (drag source) and RosterGrid (drop targets).
 *
 * Previously DndContext lived inside RosterGrid, which meant
 * draggable StaffCards in StaffSidebar were outside the context.
 */

import { ReactNode, useCallback, useState } from 'react'
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
import { useRosterStore } from '@/stores/useRosterStore'
import { RosterShift, Staff } from '@/types'
import { DRAGGABLE_SHIFT_TYPE } from './ShiftBlock'
import { DRAGGABLE_STAFF_TYPE } from './StaffCard'
import { ShiftBlock } from './ShiftBlock'
import { parse, isSameDay } from 'date-fns'
import { calculateShiftCostBreakdown } from '@/lib/utils/rosterCalculations'

export function RosterDndWrapper({ children }: { children: ReactNode }) {
  const { staff, shifts, moveShift, addShift } = useRosterStore()
  const [draggingShift, setDraggingShift] = useState<RosterShift | null>(null)

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const sensors = useSensors(mouseSensor, touchSensor)

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

    if (!over.id || !String(over.id).startsWith('cell::')) return

    const [, targetStaffId, targetDateStr] = String(over.id).split('::')
    const targetDate = parse(targetDateStr, 'yyyy-MM-dd', new Date())
    const targetStaff = staff.find(s => s.id === targetStaffId)

    if (activeData?.type === DRAGGABLE_SHIFT_TYPE) {
      const shift: RosterShift = activeData.shift
      if (shift.staff_id === targetStaffId && isSameDay(shift.date instanceof Date ? shift.date : new Date(shift.date), targetDate)) {
        return
      }
      moveShift(shift.id, targetStaffId, targetDate)
    } else if (activeData?.type === DRAGGABLE_STAFF_TYPE && targetStaff) {
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {draggingShift && (
          <div className="w-[120px] pointer-events-none rotate-2 shadow-xl opacity-90">
            <ShiftBlock shift={draggingShift} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
