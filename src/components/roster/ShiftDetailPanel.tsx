/**
 * ShiftDetailPanel — right slide-out panel with full shift details.
 * Quick actions: reassign, split time, convert to open shift, add notes.
 * Shows "this person's week" summary.
 */

import { useMemo, useState } from 'react'
import { useRosterStore, getRoleColors } from '@/stores/useRosterStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { formatTimeCompact, calculateShiftCostBreakdown } from '@/lib/utils/rosterCalculations'
import { format, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  X, Clock, DollarSign, Calendar, User, AlertTriangle,
  UserMinus, FileText, ChevronRight, RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { RosterShift } from '@/types'

const PENALTY_LABELS: Record<string, string> = {
  none: 'Base rate',
  saturday: 'Saturday',
  sunday: 'Sunday',
  public_holiday: 'Public Holiday',
  evening: 'Evening',
  early_morning: 'Early Morning',
  late_night: 'Late Night',
}

export function ShiftDetailPanel() {
  const {
    selectedShiftId, selectShift,
    shifts, staff,
    updateShift, deleteShift,
  } = useRosterStore()

  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [editingTime, setEditingTime] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const shift = useMemo(
    () => shifts.find(s => s.id === selectedShiftId) || null,
    [shifts, selectedShiftId]
  )

  const staffMember = useMemo(
    () => shift ? staff.find(s => s.id === shift.staff_id) : null,
    [staff, shift]
  )

  // This person's week summary
  const personWeek = useMemo(() => {
    if (!shift) return null
    const shiftDate = shift.date instanceof Date ? shift.date : new Date(shift.date)
    const weekShifts = shifts.filter(s => {
      if (s.staff_id !== shift.staff_id) return false
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      // same week (Mon–Sun)
      const diff = Math.abs(d.getTime() - shiftDate.getTime())
      return diff < 7 * 24 * 60 * 60 * 1000
    })
    return {
      shifts: weekShifts,
      totalHours: weekShifts.reduce((s, sh) => s + sh.total_hours, 0),
      totalCost: weekShifts.reduce((s, sh) => s + sh.total_cost, 0),
    }
  }, [shift, shifts])

  if (!shift) return null

  const shiftDate = shift.date instanceof Date ? shift.date : new Date(shift.date)
  const colors = getRoleColors(shift.role)
  const penaltyLabel = PENALTY_LABELS[shift.penalty_type || 'none'] || 'Base rate'

  const handleSaveNotes = async () => {
    setIsSaving(true)
    await updateShift(shift.id, { notes })
    setIsSaving(false)
    setEditingNotes(false)
  }

  const handleSaveTime = async () => {
    if (!shift) return
    setIsSaving(true)
    const shiftDate = shift.date instanceof Date ? shift.date : new Date(shift.date)
    const hourlyRate = staffMember?.hourly_rate || 2500
    const empType = staffMember?.employment_type || 'casual'
    const breakdown = calculateShiftCostBreakdown(
      startTime, endTime, shift.break_minutes, hourlyRate,
      shift.venue_id, shiftDate, empType,
    )
    await updateShift(shift.id, {
      start_time: startTime,
      end_time: endTime,
      total_hours: breakdown.base_hours,
      base_cost: breakdown.base_cost_cents,
      penalty_cost: breakdown.penalty_cost_cents,
      total_cost: breakdown.total_cost_cents,
      penalty_type: breakdown.penalty_type as RosterShift['penalty_type'] || 'none',
      penalty_multiplier: breakdown.penalty_multiplier,
    })
    setIsSaving(false)
    setEditingTime(false)
  }







  const handleReassign = async (newStaffId: string) => {
    const member = staff.find(s => s.id === newStaffId)
    if (!member) return
    await updateShift(shift.id, { staff_id: newStaffId, staff_name: member.name })
  }

  const handleConvertToOpen = async () => {
    await updateShift(shift.id, { is_open_shift: true, staff_id: '', staff_name: 'Open Shift' })
    selectShift(null)
  }

  const handleDelete = async () => {
    if (!shift) return
    setIsDeleting(true)
    try {
      await deleteShift(shift.id)
      selectShift(null)
    } catch (err) {
      console.error('[ShiftDetailPanel] Delete failed:', err)
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <aside className="w-80 shrink-0 bg-white border-l flex flex-col overflow-y-auto shadow-lg z-20">
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 border-b', colors.bg)}>
        <div>
          <div className={cn('text-sm font-semibold', colors.text)}>{shift.staff_name || 'Open Shift'}</div>
          <div className={cn('text-xs capitalize opacity-75', colors.text)}>{shift.role}</div>
        </div>
        <button
          onClick={() => selectShift(null)}
          className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Main shift info */}
        <div className="p-4 space-y-3 border-b">
          {/* Date */}
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
            <span>{format(shiftDate, 'EEEE, d MMMM yyyy')}</span>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400 shrink-0" />
            {editingTime ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <span className="text-gray-400">–</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <Button size="sm" className="h-7 text-xs px-2" onClick={handleSaveTime} disabled={isSaving}>
                  {isSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
              </div>
            ) : (
              <button
                className="text-sm hover:underline text-left"
                onClick={() => {
                  setStartTime(shift.start_time)
                  setEndTime(shift.end_time)
                  setEditingTime(true)
                }}
              >
                {formatTimeCompact(shift.start_time)} – {formatTimeCompact(shift.end_time)}
                <span className="text-gray-400 ml-2">({shift.total_hours.toFixed(1)}h)</span>
              </button>
            )}
          </div>

          {/* Break */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="h-4 w-4 shrink-0" />
            <span>{shift.break_minutes}min break</span>
          </div>

          {/* Cost */}
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex-1">
              <span className="font-medium">{formatCurrency(shift.total_cost)}</span>
              <span className="text-[10px] text-amber-500 ml-1">(est.)</span>
              {shift.penalty_type && shift.penalty_type !== 'none' && (
                <Badge variant="outline" className="ml-2 text-[10px] h-4">
                  {penaltyLabel} ×{shift.penalty_multiplier?.toFixed(2)}
                </Badge>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 shrink-0" />
            <Badge
              variant={shift.status === 'confirmed' ? 'default' : 'secondary'}
              className="text-[10px]"
            >
              {shift.status || 'scheduled'}
            </Badge>
          </div>
        </div>

        {/* Compliance warnings */}
        {shift.warnings && shift.warnings.length > 0 && (
          <div className="p-4 border-b bg-orange-50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-semibold text-orange-700">Compliance Warnings</span>
            </div>
            <ul className="space-y-1">
              {shift.warnings.map((w, i) => (
                <li key={i} className="text-xs text-orange-600">{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Reassign */}
        {staff.length > 0 && (
          <div className="p-4 border-b">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reassign to</Label>
            <Select onValueChange={handleReassign} value={shift.staff_id}>
              <SelectTrigger className="h-8 mt-1.5 text-xs">
                <User className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staff.filter(s => s.status === 'active').map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name} ({s.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notes */}
        <div className="p-4 border-b">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</Label>
          {editingNotes ? (
            <div className="mt-1.5 space-y-2">
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add notes…"
                className="text-xs h-20 resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleSaveNotes} disabled={isSaving}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNotes(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="mt-1.5 text-xs text-gray-500 hover:text-gray-800 text-left w-full flex items-center gap-1"
              onClick={() => { setNotes(shift.notes || ''); setEditingNotes(true) }}
            >
              <FileText className="h-3 w-3" />
              {shift.notes || 'Add notes…'}
            </button>
          )}
        </div>

        {/* Person's week summary */}
        {personWeek && personWeek.shifts.length > 1 && (
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {shift.staff_name}'s week
              </span>
            </div>
            <div className="flex gap-3 mb-2">
              <div className="text-center">
                <div className="text-sm font-bold">{personWeek.totalHours.toFixed(1)}h</div>
                <div className="text-[10px] text-gray-400">hours</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold">{formatCurrency(personWeek.totalCost)}</div>
                <div className="text-[10px] text-gray-400">cost</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold">{personWeek.shifts.length}</div>
                <div className="text-[10px] text-gray-400">shifts</div>
              </div>
            </div>
            {personWeek.totalHours > 38 && (
              <div className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {(personWeek.totalHours - 38).toFixed(1)}h overtime
              </div>
            )}
          </div>
        )}

      </div>

      {/* Quick actions — sticky bottom */}
      <div className="border-t bg-white p-3 space-y-1.5 mt-auto shrink-0">
        <button
          onClick={handleConvertToOpen}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-gray-50 transition-colors text-left border"
        >
          <UserMinus className="h-3.5 w-3.5 text-gray-400" />
          Convert to open shift
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-red-50 transition-colors text-left border border-transparent hover:border-red-200 text-red-600"
        >
          <X className="h-3.5 w-3.5" />
          Delete shift
        </button>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shift?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {shift.staff_name}'s shift on{' '}
              {format(shiftDate, 'd MMM')} ({formatTimeCompact(shift.start_time)}–
              {formatTimeCompact(shift.end_time)}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
