/**
 * RosterDndWrapper — provides DndContext that wraps both
 * StaffSidebar (drag source) and RosterGrid (drop targets).
 *
 * Shows ShiftCreateDialog on drag-and-drop to configure shift
 * before creation (start/end time, role, break).
 *
 * Checks for expired qualifications at shift-save time (soft block).
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
import { parse, isSameDay, format } from 'date-fns'
import { calculateShiftCostBreakdown } from '@/lib/utils/rosterCalculations'
import { ShiftCreateDialog, ShiftConfig } from './ShiftCreateDialog'
import { supabase } from '@/integrations/supabase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpiredQualInfo {
  name: string
  expiry_date: string
  status: 'expired' | 'expiring'
}

interface QualWarningState {
  expiredQuals: ExpiredQualInfo[]
  pendingConfig: ShiftConfig
}

// ─── Qualification checker ────────────────────────────────────────────────────

async function checkExpiredQualifications(
  staffId: string,
  role: string
): Promise<ExpiredQualInfo[]> {
  try {
    // Load qual types required for this role
    const { data: qualTypes } = await supabase
      .from('qualification_types')
      .select('id, name, required_for_roles')

    const requiredQualTypeIds = (qualTypes || [])
      .filter((qt) => (qt.required_for_roles as string[]).includes(role))
      .map((qt) => qt.id)

    if (requiredQualTypeIds.length === 0) return []

    // Load staff's qualifications for required types
    const { data: staffQuals } = await supabase
      .from('staff_qualifications')
      .select('qualification_type_id, expiry_date, status')
      .eq('staff_id', staffId)
      .in('qualification_type_id', requiredQualTypeIds)

    const now = new Date()
    const in30 = new Date(now)
    in30.setDate(in30.getDate() + 30)

    const expired: ExpiredQualInfo[] = []
    for (const qtId of requiredQualTypeIds) {
      const qual = (staffQuals || []).find((q) => q.qualification_type_id === qtId)
      const qtName = (qualTypes || []).find((qt) => qt.id === qtId)?.name || 'Unknown'

      if (!qual) {
        // Not on file at all — skip (separate gap check, not a hard block here)
        continue
      }

      if (qual.expiry_date) {
        const expiry = new Date(qual.expiry_date)
        if (expiry < now) {
          expired.push({ name: qtName, expiry_date: qual.expiry_date, status: 'expired' })
        } else if (expiry <= in30) {
          expired.push({ name: qtName, expiry_date: qual.expiry_date, status: 'expiring' })
        }
      }
    }

    return expired
  } catch {
    // Don't block shift creation if qual check fails
    return []
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RosterDndWrapper({ children }: { children: ReactNode }) {
  const { staff, shifts, moveShift, addShift, pendingShift, setPendingShift } = useRosterStore()
  const [draggingShift, setDraggingShift] = useState<RosterShift | null>(null)
  const [qualWarning, setQualWarning] = useState<QualWarningState | null>(null)

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
      // Open dialog instead of creating shift directly
      setPendingShift({
        staffId: staffMember.id,
        staffName: staffMember.name,
        date: targetDate,
        defaultRole: staffMember.role,
        venueId: targetStaff.venue_id || '',
        employmentType: staffMember.employment_type || 'casual',
        hourlyRateCents: staffMember.hourly_rate,
      })
    }
  }, [staff, moveShift, setPendingShift])

  // ── doAddShift — the actual shift creation, called after qual check ──────
  // Uses the current pendingShift from the store directly (not from closure)
  // to avoid stale-closure issues with useCallback.

  const doAddShift = useCallback((config: ShiftConfig) => {
    const currentPending = useRosterStore.getState().pendingShift
    if (!currentPending) return
    const breakdown = calculateShiftCostBreakdown(
      config.startTime, config.endTime, config.breakMinutes,
      currentPending.hourlyRateCents || 0,
      currentPending.venueId,
      currentPending.date,
      currentPending.employmentType,
    )
    addShift({
      staff_id: currentPending.staffId,
      staff_name: currentPending.staffName,
      date: currentPending.date,
      start_time: config.startTime,
      end_time: config.endTime,
      break_minutes: config.breakMinutes,
      role: config.role,
      total_hours: breakdown.base_hours,
      base_cost: breakdown.base_cost_cents,
      penalty_cost: breakdown.penalty_cost_cents,
      total_cost: breakdown.total_cost_cents,
      penalty_type: breakdown.penalty_type as RosterShift['penalty_type'] || 'none',
      penalty_multiplier: breakdown.penalty_multiplier,
    })
    setPendingShift(null)
  }, [addShift, setPendingShift])

  // ── handleShiftConfirm — checks quals before creating ────────────────────

  const handleShiftConfirm = useCallback(async (config: ShiftConfig) => {
    const currentPending = useRosterStore.getState().pendingShift
    if (!currentPending) return

    try {
      const expiredQuals = await checkExpiredQualifications(currentPending.staffId, config.role)
      if (expiredQuals.length > 0) {
        setQualWarning({ expiredQuals, pendingConfig: config })
        return
      }
    } catch {
      // Don't block shift creation if qual check fails
    }

    doAddShift(config)
  }, [doAddShift])

  const handleShiftCancel = useCallback(() => {
    setPendingShift(null)
  }, [setPendingShift])

  // ── Qual warning dialog handlers ─────────────────────────────────────────

  const handleQualOverride = useCallback(() => {
    if (!qualWarning) return
    const config = qualWarning.pendingConfig
    setQualWarning(null)
    doAddShift(config)
  }, [qualWarning, doAddShift])



  const handleQualCancel = useCallback(() => {
    setQualWarning(null)
    // Keep the shift config dialog open by NOT calling setPendingShift(null)
  }, [])

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {draggingShift && (
            <div className="w-[120px] pointer-events-none rotate-2 shadow-xl opacity-90">
              <ShiftBlock shift={draggingShift} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Dialogs rendered OUTSIDE DndContext to prevent DragOverlay z-index from blocking clicks */}
      <ShiftCreateDialog
        pendingShift={pendingShift}
        onConfirm={handleShiftConfirm}
        onCancel={handleShiftCancel}
      />

      {/* Expired qualification warning — soft block */}
      <AlertDialog open={!!qualWarning} onOpenChange={(open) => !open && handleQualCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Qualification Warning
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  <strong>{pendingShift?.staffName}</strong> has qualifications that are expired or
                  expiring soon for the <strong>{qualWarning?.pendingConfig.role}</strong> role.
                </p>
                <div className="space-y-1.5">
                  {qualWarning?.expiredQuals.map((q) => (
                    <div
                      key={q.name}
                      className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{q.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">
                          {q.status === 'expired' ? 'Expired' : 'Expires'}{' '}
                          {format(new Date(q.expiry_date), 'dd MMM yyyy')}
                        </span>
                        <Badge
                          variant={q.status === 'expired' ? 'destructive' : 'outline'}
                          className={
                            q.status === 'expiring'
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : ''
                          }
                        >
                          {q.status === 'expired' ? 'Expired' : 'Expiring'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  You can override and save the shift anyway, or cancel to update qualifications
                  first.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleQualCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleQualOverride}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Save Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
