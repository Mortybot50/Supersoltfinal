/**
 * Availability & Leave — unified page for staff availability patterns and leave management.
 * Route: /workforce/availability
 *
 * Sections:
 *   1. Recurring Availability — weekly grid (staff × day)
 *   2. Leave Requests — tabbed list (Pending / Approved / Declined)
 *   3. Calendar View — monthly leave calendar (toggle, hidden on mobile)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWithinInterval, parseISO } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  getLeaveRequests,
  createLeaveRequest,
  approveLeave,
  declineLeave,
  getLeaveBalances,
  calculateLeaveImpact,
  getStaffAvailability,
  upsertStaffAvailability,
  type LeaveRequest,
  type LeaveType,
  type LeaveStatus,
  type LeaveBalance,
  type StaffAvailabilityRecord,
} from '@/lib/services/leaveService'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Clock,
} from 'lucide-react'
import { PageShell, PageToolbar } from '@/components/shared'

// ─── Constants ────────────────────────────────────────────────

// Mon–Sun column order; DB day_of_week: 0=Sun, 1=Mon … 6=Sat
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const DAY_DOW = [1, 2, 3, 4, 5, 6, 0] // index → DB day_of_week value

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Annual',
  personal: 'Personal',
  unpaid: 'Unpaid',
  long_service: 'Long Service',
  compassionate: 'Compassionate',
  other: 'Other',
}

const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  annual: 'bg-blue-100 text-blue-800',
  personal: 'bg-green-100 text-green-800',
  unpaid: 'bg-orange-100 text-orange-800',
  long_service: 'bg-purple-100 text-purple-800',
  compassionate: 'bg-pink-100 text-pink-800',
  other: 'bg-gray-100 text-gray-700',
}

/** VIC + national public holidays 2025-2026 (hardcoded for MVP) */
const PUBLIC_HOLIDAYS = new Set([
  '2025-01-01', '2025-01-27', '2025-03-10', '2025-04-18', '2025-04-19',
  '2025-04-20', '2025-04-21', '2025-04-25', '2025-06-09', '2025-11-04',
  '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-01-26', '2026-03-09', '2026-04-03', '2026-04-04',
  '2026-04-05', '2026-04-06', '2026-04-25', '2026-06-08', '2026-11-03',
  '2026-12-25', '2026-12-28',
])

// ─── Staff type (lightweight) ─────────────────────────────────

interface StaffRow {
  id: string
  name: string
  start_date: string | null
}

// ─── Helpers ──────────────────────────────────────────────────

function leaveDuration(req: LeaveRequest): number {
  const ms = parseISO(req.end_date).getTime() - parseISO(req.start_date).getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1
}

function formatDateRange(start: string, end: string): string {
  const s = parseISO(start)
  const e = parseISO(end)
  if (start === end) return format(s, 'd MMM yyyy')
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, 'd MMM')} – ${format(e, 'd MMM yyyy')}`
  }
  return `${format(s, 'd MMM yyyy')} – ${format(e, 'd MMM yyyy')}`
}

// ─── Sub-components ───────────────────────────────────────────

function LeaveTypeBadge({ type }: { type: LeaveType }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', LEAVE_TYPE_COLORS[type])}>
      {LEAVE_TYPE_LABELS[type]}
    </span>
  )
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const map: Record<LeaveStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  const labels: Record<LeaveStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Declined',
    cancelled: 'Cancelled',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', map[status])}>
      {labels[status]}
    </span>
  )
}

// ─── Availability Cell Edit Dialog ───────────────────────────

interface AvailabilityEditDialogProps {
  open: boolean
  staffName: string
  dayLabel: string
  existing: StaffAvailabilityRecord | undefined
  staffId: string
  dayOfWeek: number
  onClose: () => void
  onSaved: () => void
}

function AvailabilityEditDialog({
  open,
  staffName,
  dayLabel,
  existing,
  staffId,
  dayOfWeek,
  onClose,
  onSaved,
}: AvailabilityEditDialogProps) {
  const [isAvailable, setIsAvailable] = useState(existing?.is_available ?? true)
  const [startTime, setStartTime] = useState(existing?.start_time ?? '')
  const [endTime, setEndTime] = useState(existing?.end_time ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setIsAvailable(existing?.is_available ?? true)
      setStartTime(existing?.start_time ?? '')
      setEndTime(existing?.end_time ?? '')
    }
  }, [open, existing])

  async function handleSave() {
    setSaving(true)
    const ok = await upsertStaffAvailability({
      staff_id: staffId,
      day_of_week: dayOfWeek,
      is_available: isAvailable,
      start_time: isAvailable && startTime ? startTime : null,
      end_time: isAvailable && endTime ? endTime : null,
    })
    setSaving(false)
    if (ok) {
      onSaved()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {staffName} — {dayLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label>Available</Label>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>
          {isAvailable && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Until</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Leave Request Dialog ─────────────────────────────────────

interface LeaveRequestDialogProps {
  open: boolean
  staff: StaffRow[]
  userId: string
  onClose: () => void
  onCreated: () => void
}

function LeaveRequestDialog({
  open,
  staff,
  userId,
  onClose,
  onCreated,
}: LeaveRequestDialogProps) {
  const [staffId, setStaffId] = useState('')
  const [leaveType, setLeaveType] = useState<LeaveType>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setStaffId(staff[0]?.id ?? '')
      setLeaveType('annual')
      setStartDate('')
      setEndDate('')
      setReason('')
    }
  }, [open, staff])

  async function handleSubmit() {
    if (!staffId || !startDate || !endDate) return
    setSubmitting(true)
    const result = await createLeaveRequest({
      staff_id: staffId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason,
      created_by: userId,
    })
    setSubmitting(false)
    if (result) {
      onCreated()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Staff Member</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select staff…" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Leave Type</Label>
            <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {LEAVE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                className="mt-1"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (!endDate || e.target.value > endDate) setEndDate(e.target.value)
                }}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                className="mt-1"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              className="mt-1 resize-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any notes or context…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !staffId || !startDate || !endDate}
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Decline Reason Dialog ────────────────────────────────────

function DeclineDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Decline Leave Request</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Label>Reason for declining</Label>
          <Textarea
            className="mt-1 resize-none"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this request was declined…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
          >
            Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Leave Detail Sheet ───────────────────────────────────────

interface LeaveDetailSheetProps {
  request: LeaveRequest | null
  staffMap: Record<string, StaffRow>
  userId: string
  onClose: () => void
  onAction: () => void
}

function LeaveDetailSheet({
  request,
  staffMap,
  userId,
  onClose,
  onAction,
}: LeaveDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('details')
  const [showDecline, setShowDecline] = useState(false)
  const [acting, setActing] = useState(false)
  const [impact, setImpact] = useState<{ shiftsAffected: number; hoursAffected: number } | null>(null)
  const [balances, setBalances] = useState<LeaveBalance[]>([])

  const requestId = request?.id
  useEffect(() => {
    if (!requestId) return
    setActiveTab('details')
    setImpact(null)
    setBalances([])
  }, [requestId])

  useEffect(() => {
    if (!request || activeTab !== 'shifts') return
    calculateLeaveImpact(request.id).then(setImpact)
  }, [request, activeTab])

  useEffect(() => {
    if (!request || activeTab !== 'balances') return
    const staff = staffMap[request.staff_id]
    if (!staff?.start_date) return
    getLeaveBalances(request.staff_id, new Date(staff.start_date)).then(setBalances)
  }, [request, activeTab, staffMap])

  async function handleApprove() {
    if (!request) return
    setActing(true)
    await approveLeave(request.id, userId)
    setActing(false)
    onAction()
    onClose()
  }

  async function handleDecline(reason: string) {
    if (!request) return
    setShowDecline(false)
    setActing(true)
    await declineLeave(request.id, reason, userId)
    setActing(false)
    onAction()
    onClose()
  }

  if (!request) return null

  const staff = staffMap[request.staff_id]

  return (
    <>
      <Sheet open={!!request} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Leave Request</SheetTitle>
            <div className="flex items-center gap-2 mt-1">
              <LeaveTypeBadge type={request.leave_type} />
              <StatusBadge status={request.status} />
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="shifts" className="flex-1">Affected Shifts</TabsTrigger>
              <TabsTrigger value="balances" className="flex-1">Balances</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Staff Member</p>
                  <p className="font-medium">{staff?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Duration</p>
                  <p className="font-medium">{leaveDuration(request)} day{leaveDuration(request) !== 1 ? 's' : ''}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Date Range</p>
                  <p className="font-medium">{formatDateRange(request.start_date, request.end_date)}</p>
                </div>
                {request.reason && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Reason</p>
                    <p className="text-sm">{request.reason}</p>
                  </div>
                )}
                {request.rejection_reason && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Decline Reason</p>
                    <p className="text-sm text-red-600">{request.rejection_reason}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs mb-0.5">Submitted</p>
                  <p className="text-sm">{format(parseISO(request.created_at), 'd MMM yyyy')}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="shifts">
              {impact === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : impact.shiftsAffected === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Check className="h-4 w-4 text-emerald-500" />
                  No rostered shifts during this period.
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">
                      {impact.shiftsAffected} shift{impact.shiftsAffected !== 1 ? 's' : ''} affected
                    </p>
                    <p className="text-amber-700 mt-0.5">
                      {impact.hoursAffected.toFixed(1)} hours will need to be covered.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="balances">
              {balances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <div className="space-y-3">
                  {balances.map((b) => (
                    <div key={b.leave_type} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <LeaveTypeBadge type={b.leave_type} />
                        <span className="text-sm font-semibold">
                          {b.remaining_days} day{b.remaining_days !== 1 ? 's' : ''} remaining
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{
                            width: b.accrued_days > 0
                              ? `${Math.min(100, (b.remaining_days / b.accrued_days) * 100)}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{b.taken_days} taken</span>
                        <span>{b.accrued_days} accrued</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="flex gap-2 mt-6 pt-4 border-t">
              <Button
                className="flex-1"
                onClick={handleApprove}
                disabled={acting}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setShowDecline(true)}
                disabled={acting}
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <DeclineDialog
        open={showDecline}
        onClose={() => setShowDecline(false)}
        onConfirm={handleDecline}
      />
    </>
  )
}

// ─── Availability Grid ────────────────────────────────────────

interface AvailabilityGridProps {
  staff: StaffRow[]
  availability: StaffAvailabilityRecord[]
  onCellClick: (staffId: string, staffName: string, dayIndex: number) => void
}

function AvailabilityGrid({ staff, availability, onCellClick }: AvailabilityGridProps) {
  // Build lookup: staffId -> dayOfWeek -> record
  const lookup: Record<string, Record<number, StaffAvailabilityRecord>> = {}
  for (const rec of availability) {
    if (!lookup[rec.staff_id]) lookup[rec.staff_id] = {}
    lookup[rec.staff_id][rec.day_of_week] = rec
  }

  if (staff.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No active staff found for this venue.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 pl-3 font-medium text-muted-foreground w-40 sticky left-0 bg-background z-10">
              Staff
            </th>
            {DAYS.map((d) => (
              <th key={d} className="text-center py-2 px-2 font-medium text-muted-foreground min-w-[72px]">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {staff.map((s) => (
            <tr key={s.id} className="hover:bg-muted/30">
              <td className="py-2 pr-4 pl-3 font-medium sticky left-0 bg-background z-10 border-r">
                <span className="truncate block max-w-[140px]" title={s.name}>
                  {s.name}
                </span>
              </td>
              {DAYS.map((dayLabel, dayIdx) => {
                const dow = DAY_DOW[dayIdx]
                const rec = lookup[s.id]?.[dow]
                const isAvailable = rec ? rec.is_available : null

                return (
                  <td key={dayLabel} className="py-1.5 px-1 text-center">
                    <button
                      onClick={() => onCellClick(s.id, s.name, dayIdx)}
                      className={cn(
                        'w-full min-w-[60px] rounded-md px-1 py-1.5 text-xs font-medium transition-colors border',
                        isAvailable === null
                          ? 'border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
                          : isAvailable
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200',
                      )}
                    >
                      {isAvailable === null ? (
                        <span className="opacity-50">—</span>
                      ) : isAvailable ? (
                        <span>
                          {rec?.start_time && rec?.end_time
                            ? `${rec.start_time.slice(0, 5)}–${rec.end_time.slice(0, 5)}`
                            : 'Available'}
                        </span>
                      ) : (
                        <span>Unavailable</span>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Leave Calendar ───────────────────────────────────────────

interface LeaveCalendarProps {
  month: Date
  onPrevMonth: () => void
  onNextMonth: () => void
  leaveRequests: LeaveRequest[]
  availability: StaffAvailabilityRecord[]
  staffMap: Record<string, StaffRow>
}

function LeaveCalendar({
  month,
  onPrevMonth,
  onNextMonth,
  leaveRequests,
  staffMap,
}: LeaveCalendarProps) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })

  // Pad to start on Monday
  const startDow = (start.getDay() + 6) % 7 // Mon=0
  const paddedDays: (Date | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...days,
  ]

  const approvedLeave = leaveRequests.filter((r) => r.status === 'approved')

  function getLeavesForDay(date: Date): Array<{ request: LeaveRequest; staffName: string }> {
    return approvedLeave
      .filter((r) => {
        const s = parseISO(r.start_date)
        const e = parseISO(r.end_date)
        return isWithinInterval(date, { start: s, end: e })
      })
      .map((r) => ({ request: r, staffName: staffMap[r.staff_id]?.name ?? 'Unknown' }))
  }

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{format(month, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {dayHeaders.map((d) => (
          <div key={d} className="bg-muted/50 text-xs font-medium text-muted-foreground text-center py-1.5">
            {d}
          </div>
        ))}
        {paddedDays.map((date, i) => {
          if (!date) {
            return <div key={`pad-${i}`} className="bg-background min-h-[60px]" />
          }
          const dateStr = format(date, 'yyyy-MM-dd')
          const isHoliday = PUBLIC_HOLIDAYS.has(dateStr)
          const leaves = getLeavesForDay(date)
          const isCurrentMonth = isSameMonth(date, month)

          return (
            <div
              key={dateStr}
              className={cn(
                'bg-background min-h-[60px] p-1',
                !isCurrentMonth && 'opacity-40',
                isHoliday && 'bg-amber-50/60',
              )}
            >
              <div className={cn(
                'text-xs font-medium mb-1',
                isHoliday ? 'text-amber-700' : 'text-foreground',
              )}>
                {format(date, 'd')}
              </div>
              <div className="space-y-0.5">
                {leaves.slice(0, 3).map(({ request, staffName }) => (
                  <div
                    key={request.id}
                    className={cn(
                      'text-[10px] px-1 py-0.5 rounded truncate font-medium',
                      LEAVE_TYPE_COLORS[request.leave_type],
                    )}
                    title={`${staffName} — ${LEAVE_TYPE_LABELS[request.leave_type]}`}
                  >
                    {staffName.split(' ')[0]}
                  </div>
                ))}
                {leaves.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{leaves.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([type, label]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-sm', LEAVE_TYPE_COLORS[type])} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-100" />
          <span className="text-xs text-muted-foreground">Public Holiday</span>
        </div>
      </div>
    </div>
  )
}

// ─── Leave Requests List ──────────────────────────────────────

function LeaveRow({
  request,
  staffMap,
  onClick,
}: {
  request: LeaveRequest
  staffMap: Record<string, StaffRow>
  onClick: () => void
}) {
  const staff = staffMap[request.staff_id]
  const duration = leaveDuration(request)

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors border-b last:border-b-0"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{staff?.name ?? '—'}</span>
          <LeaveTypeBadge type={request.leave_type} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <Clock className="h-3.5 w-3.5" />
          <span>{duration} day{duration !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
        <span>{formatDateRange(request.start_date, request.end_date)}</span>
        {request.status === 'rejected' && request.rejection_reason && (
          <span className="text-red-600 truncate">Reason: {request.rejection_reason}</span>
        )}
      </div>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function AvailabilityLeave() {
  const { currentVenue, currentOrg, user } = useAuth()
  const queryClient = useQueryClient()

  const [showRequestDialog, setShowRequestDialog] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [editingCell, setEditingCell] = useState<{
    staffId: string
    staffName: string
    dayIndex: number
  } | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [showCalendar, setShowCalendar] = useState(true)

  const venueId = currentVenue?.id ?? ''
  const orgId = currentOrg?.id ?? ''
  const userId = user?.id ?? ''

  // ── Staff query ──────────────────────────────────────────────

  const { data: staff = [] } = useQuery<StaffRow[]>({
    queryKey: ['leave-staff', venueId],
    queryFn: async () => {
      if (!venueId) return []
      const { data, error } = await supabase
        .from('staff')
        .select('id, start_date, org_members!inner(profiles!inner(first_name, last_name))')
        .eq('venue_id', venueId)
        .order('created_at')
      if (error) throw error
      return (data ?? []).map((s) => {
        const profile = (s as Record<string, unknown> & { org_members: { profiles: { first_name: string | null; last_name: string | null } } }).org_members?.profiles
        const name = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Unknown'
        return { id: s.id, name, start_date: s.start_date as string | null }
      })
    },
    enabled: !!venueId,
  })

  const staffMap = Object.fromEntries(staff.map((s) => [s.id, s]))

  // ── Leave queries ────────────────────────────────────────────

  const leaveQueryKey = useMemo(() => ['leave-requests', venueId, orgId], [venueId, orgId])

  const { data: allLeave = [] } = useQuery<LeaveRequest[]>({
    queryKey: leaveQueryKey,
    queryFn: () => getLeaveRequests(venueId),
    enabled: !!venueId,
  })

  const pendingLeave = allLeave.filter((r) => r.status === 'pending')
  const approvedLeave = allLeave.filter((r) => r.status === 'approved')
  const declinedLeave = allLeave.filter((r) => r.status === 'rejected' || r.status === 'cancelled')

  const invalidateLeave = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: leaveQueryKey })
  }, [queryClient, leaveQueryKey])

  // ── Availability query ───────────────────────────────────────

  const availQueryKey = useMemo(() => ['staff-availability', venueId], [venueId])

  const { data: availability = [] } = useQuery<StaffAvailabilityRecord[]>({
    queryKey: availQueryKey,
    queryFn: () => getStaffAvailability(venueId),
    enabled: !!venueId,
  })

  const invalidateAvail = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: availQueryKey })
  }, [queryClient, availQueryKey])

  // ── Cell edit state ──────────────────────────────────────────

  const editingAvailRecord = editingCell
    ? availability.find(
        (r) =>
          r.staff_id === editingCell.staffId &&
          r.day_of_week === DAY_DOW[editingCell.dayIndex],
      )
    : undefined

  // ── Render ───────────────────────────────────────────────────

  return (
    <PageShell
      toolbar={
        <PageToolbar
          title="Availability &amp; Leave"
          primaryAction={{
            label: 'Request Leave',
            icon: Plus,
            onClick: () => setShowRequestDialog(true),
          }}
        />
      }
    >
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* ── Section 1: Recurring Availability ─────────────────── */}
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Recurring Availability</h2>
          <span className="text-xs text-muted-foreground ml-1">Click a cell to edit</span>
        </div>
        <div className="p-4">
          <AvailabilityGrid
            staff={staff}
            availability={availability}
            onCellClick={(staffId, staffName, dayIndex) =>
              setEditingCell({ staffId, staffName, dayIndex })
            }
          />
        </div>
      </section>

      {/* ── Section 2: Leave Requests ──────────────────────────── */}
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Leave Requests</h2>
        </div>
        <Tabs defaultValue="pending" className="p-0">
          <div className="px-4 pt-3">
            <TabsList>
              <TabsTrigger value="pending">
                Pending
                {pendingLeave.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
                    {pendingLeave.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="declined">Declined</TabsTrigger>
            </TabsList>
          </div>

          {(['pending', 'approved', 'declined'] as const).map((tab) => {
            const rows =
              tab === 'pending' ? pendingLeave : tab === 'approved' ? approvedLeave : declinedLeave
            return (
              <TabsContent key={tab} value={tab} className="mt-0">
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-4 py-6 text-center">
                    No {tab} leave requests.
                  </p>
                ) : (
                  <div className="divide-y border-t mt-3">
                    {rows.map((r) => (
                      <LeaveRow
                        key={r.id}
                        request={r}
                        staffMap={staffMap}
                        onClick={() => setSelectedRequest(r)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      </section>

      {/* ── Section 3: Calendar View (hidden on mobile) ────────── */}
      <section className="hidden md:block rounded-xl border bg-card shadow-sm">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Calendar View</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setShowCalendar((v) => !v)}
          >
            {showCalendar ? 'Hide' : 'Show'}
          </Button>
        </div>
        {showCalendar && (
          <div className="p-4">
            <LeaveCalendar
              month={calendarMonth}
              onPrevMonth={() => setCalendarMonth((m) => subMonths(m, 1))}
              onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
              leaveRequests={allLeave}
              availability={availability}
              staffMap={staffMap}
            />
          </div>
        )}
      </section>

      {/* ── Dialogs & Sheets ───────────────────────────────────── */}

      <LeaveRequestDialog
        open={showRequestDialog}
        staff={staff}
        userId={userId}
        onClose={() => setShowRequestDialog(false)}
        onCreated={invalidateLeave}
      />

      <AvailabilityEditDialog
        open={!!editingCell}
        staffName={editingCell?.staffName ?? ''}
        dayLabel={editingCell ? DAYS[editingCell.dayIndex] : ''}
        existing={editingAvailRecord}
        staffId={editingCell?.staffId ?? ''}
        dayOfWeek={editingCell ? DAY_DOW[editingCell.dayIndex] : 0}
        onClose={() => setEditingCell(null)}
        onSaved={invalidateAvail}
      />

      <LeaveDetailSheet
        request={selectedRequest}
        staffMap={staffMap}
        userId={userId}
        onClose={() => setSelectedRequest(null)}
        onAction={invalidateLeave}
      />
    </div>
    </PageShell>
  )
}
