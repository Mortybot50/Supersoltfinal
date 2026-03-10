/**
 * PublishDialog — 4-step wizard for publishing the roster.
 * Step 1: What to publish (all drafts vs changes only)
 * Step 2: Budget check (cost vs labor_budgets target)
 * Step 3: Compliance review (critical warnings must be acknowledged)
 * Step 4: Review & confirm (shift table by day + notification preview)
 */

import { useMemo, useState } from 'react'
import { useRosterStore } from '@/stores/useRosterStore'
import { useDataStore } from '@/lib/store/dataStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { format, addDays } from 'date-fns'
import {
  getAllRosterWarnings,
  calculateWeeklyRosterMetrics,
  calculateBudgetVariance,
} from '@/lib/utils/rosterCalculations'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Users,
  TrendingUp,
  ShieldAlert,
  CalendarDays,
} from 'lucide-react'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PublishMode = 'all' | 'changes'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function PublishDialog({ open, onOpenChange }: PublishDialogProps) {
  const { shifts, availability, selectedDate, publishRoster, staff } = useRosterStore()
  const { getLaborBudgetForWeek } = useDataStore()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [publishMode, setPublishMode] = useState<PublishMode>('all')
  const [notifyNoShifts, setNotifyNoShifts] = useState(false)
  const [complianceAcknowledged, setComplianceAcknowledged] = useState(false)
  const [overBudgetReason, setOverBudgetReason] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  const weekEnd = addDays(selectedDate, 6)

  const weekShifts = useMemo(() => {
    return shifts.filter(s => {
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      return d >= selectedDate && d <= weekEnd
    })
  }, [shifts, selectedDate, weekEnd])

  const draftShifts = weekShifts.filter(s => s.status === 'scheduled')
  const modifiedShifts = weekShifts.filter(s => s.status === 'modified')
  const confirmedShifts = weekShifts.filter(s => s.status === 'confirmed')

  const shiftsToPublish = publishMode === 'all'
    ? [...draftShifts, ...modifiedShifts]
    : draftShifts

  const staffToNotify = [...new Set(shiftsToPublish.map(s => s.staff_id))]

  const noShiftStaff = notifyNoShifts
    ? staff.filter(m => !staffToNotify.includes(m.id))
    : []

  // Budget
  const budget = useMemo(() => getLaborBudgetForWeek(selectedDate), [selectedDate, getLaborBudgetForWeek])
  const metrics = useMemo(() => calculateWeeklyRosterMetrics(weekShifts), [weekShifts])
  const budgetStatus = useMemo(() => calculateBudgetVariance(budget, metrics.totalCost), [budget, metrics.totalCost])

  // Compliance warnings
  const warnings = useMemo(
    () => getAllRosterWarnings(weekShifts, availability),
    [weekShifts, availability]
  )
  const criticalWarnings = warnings.filter(w => w.severity === 'error')
  const standardWarnings = warnings.filter(w => w.severity !== 'error')

  // Whether publish is blocked (hard budget block: >15% over AND no reason)
  const isBudgetHardBlock = budgetStatus.variancePercent > 115 && !overBudgetReason.trim()

  const canProceedStep3 = criticalWarnings.length === 0 || complianceAcknowledged
  const canPublish = shiftsToPublish.length > 0 && !isBudgetHardBlock && canProceedStep3

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      await publishRoster(selectedDate, publishMode)
      onOpenChange(false)
      resetState()
    } finally {
      setIsPublishing(false)
    }
  }

  const resetState = () => {
    setStep(1)
    setPublishMode('all')
    setNotifyNoShifts(false)
    setComplianceAcknowledged(false)
    setOverBudgetReason('')
  }

  const handleClose = (v: boolean) => {
    if (!v) resetState()
    onOpenChange(v)
  }

  // ── Step indicators ──────────────────────────────────────────────────────
  const steps = [
    { num: 1, label: 'Scope', icon: CalendarDays },
    { num: 2, label: 'Budget', icon: TrendingUp },
    { num: 3, label: 'Compliance', icon: ShieldAlert },
    { num: 4, label: 'Confirm', icon: Send },
  ] as const

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-teal-500" />
            Publish Roster
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-1 mb-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1">
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-colors',
                  step === s.num
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : step > s.num
                    ? 'bg-teal-100 border-teal-400 text-teal-700'
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                )}
              >
                {s.num}
              </div>
              <span className={cn(
                'text-xs hidden sm:inline',
                step === s.num ? 'text-teal-700 font-medium' : 'text-gray-400'
              )}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={cn(
                  'flex-1 h-px w-6 mx-1',
                  step > s.num ? 'bg-teal-400' : 'bg-gray-200'
                )} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: What to publish ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <RadioGroup
              value={publishMode}
              onValueChange={(v) => setPublishMode(v as PublishMode)}
              className="space-y-2"
            >
              <div className={cn(
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                publishMode === 'all' ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
              )}>
                <RadioGroupItem value="all" id="mode-all" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="mode-all" className="font-medium cursor-pointer">
                    Publish All Draft Shifts
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {draftShifts.length + modifiedShifts.length} shifts
                    ({draftShifts.length} new{modifiedShifts.length > 0 ? `, ${modifiedShifts.length} modified` : ''})
                  </p>
                </div>
              </div>
              <div className={cn(
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                publishMode === 'changes' ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
              )}>
                <RadioGroupItem value="changes" id="mode-changes" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="mode-changes" className="font-medium cursor-pointer">
                    Publish Changes Only
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {draftShifts.length} new draft shift{draftShifts.length !== 1 ? 's' : ''} (excludes already-published)
                  </p>
                </div>
              </div>
            </RadioGroup>

            <div className="flex items-start gap-2 rounded-lg border p-3">
              <Checkbox
                id="notify-no-shifts"
                checked={notifyNoShifts}
                onCheckedChange={(c) => setNotifyNoShifts(c === true)}
                className="mt-0.5"
              />
              <Label htmlFor="notify-no-shifts" className="text-sm cursor-pointer">
                Include notification for staff with no shifts this week
                {notifyNoShifts && noShiftStaff.length > 0 && (
                  <span className="text-gray-400 font-normal"> ({noShiftStaff.length} staff)</span>
                )}
              </Label>
            </div>

            <div className="rounded-lg bg-gray-50 border p-3 text-sm text-gray-600">
              Publishing{' '}
              <span className="font-semibold text-gray-900">
                {shiftsToPublish.length} shift{shiftsToPublish.length !== 1 ? 's' : ''}
              </span>{' '}
              for{' '}
              <span className="font-semibold text-gray-900">
                {staffToNotify.length} staff member{staffToNotify.length !== 1 ? 's' : ''}
              </span>
              {confirmedShifts.length > 0 && (
                <span className="text-gray-400"> · {confirmedShifts.length} already published</span>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Budget check ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {!budget ? (
              <div className="rounded-lg bg-gray-50 border p-4 text-center text-sm text-gray-500">
                No labor budget set for this week.{' '}
                <span className="text-gray-400">Budget targets can be configured in Labour settings.</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-gray-50 border p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Budget</div>
                    <div className="text-lg font-bold">{formatCurrency(budgetStatus.budgeted / 100)}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 border p-3 text-center">
                    <div className="text-xs text-gray-400 mb-1">Actual</div>
                    <div className="text-lg font-bold">{formatCurrency(budgetStatus.actual / 100)}</div>
                  </div>
                  <div className={cn(
                    'rounded-lg border p-3 text-center',
                    budgetStatus.status === 'under' || budgetStatus.status === 'warning'
                      ? 'bg-green-50 border-green-200'
                      : budgetStatus.variancePercent > 115
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200'
                  )}>
                    <div className="text-xs text-gray-400 mb-1">Variance</div>
                    <div className={cn(
                      'text-lg font-bold',
                      budgetStatus.status === 'under' || budgetStatus.status === 'warning'
                        ? 'text-green-700'
                        : budgetStatus.variancePercent > 115
                        ? 'text-red-700'
                        : 'text-amber-700'
                    )}>
                      {budgetStatus.variancePercent}%
                    </div>
                  </div>
                </div>

                {(budgetStatus.status === 'under' || budgetStatus.status === 'warning') && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="text-sm text-green-700">
                      Labour cost is within budget — good to proceed.
                    </span>
                  </div>
                )}

                {budgetStatus.variancePercent > 105 && budgetStatus.variancePercent <= 115 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="text-sm font-medium text-amber-700">
                        Over budget by {budgetStatus.variancePercent - 100}%
                      </span>
                    </div>
                    <p className="text-xs text-amber-600">
                      Labour cost ({formatCurrency(budgetStatus.actual / 100)}) exceeds target
                      ({formatCurrency(budgetStatus.budgeted / 100)}). Review shift costs or adjust the budget.
                    </p>
                  </div>
                )}

                {budgetStatus.variancePercent > 115 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      <span className="text-sm font-medium text-red-700">
                        Significantly over budget ({budgetStatus.variancePercent - 100}% above target)
                      </span>
                    </div>
                    <p className="text-xs text-red-600">
                      Labour cost is {budgetStatus.variancePercent}% of budget. A reason is required to publish.
                    </p>
                    <Textarea
                      placeholder="Reason for publishing over budget…"
                      value={overBudgetReason}
                      onChange={(e) => setOverBudgetReason(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Compliance review ───────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            {warnings.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700">No compliance issues</p>
                  <p className="text-xs text-green-600">All shifts are within Fair Work guidelines.</p>
                </div>
              </div>
            ) : (
              <>
                {criticalWarnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                      Critical — {criticalWarnings.length} issue{criticalWarnings.length !== 1 ? 's' : ''}
                    </p>
                    {criticalWarnings.map(w => (
                      <div key={w.id} className="rounded-md bg-red-50 border border-red-200 px-3 py-2 flex gap-2">
                        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-medium text-red-700">{w.staff_name}</span>
                          <p className="text-xs text-red-600">{w.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {standardWarnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                      Warnings — {standardWarnings.length}
                    </p>
                    {standardWarnings.map(w => (
                      <div key={w.id} className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-medium text-amber-700">{w.staff_name}</span>
                          <p className="text-xs text-amber-600">{w.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {criticalWarnings.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 mt-2">
                    <Checkbox
                      id="ack-compliance"
                      checked={complianceAcknowledged}
                      onCheckedChange={(c) => setComplianceAcknowledged(c === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="ack-compliance" className="text-sm text-red-700 cursor-pointer">
                      I acknowledge these compliance issues and wish to publish anyway.
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 4: Review & Confirm ────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Shifts by day */}
            <div className="space-y-2">
              {DAYS.map((dayLabel, i) => {
                const dayDate = addDays(selectedDate, i)
                const dayShifts = shiftsToPublish.filter(s => {
                  const d = s.date instanceof Date ? s.date : new Date(s.date)
                  return d.toDateString() === dayDate.toDateString()
                })
                if (dayShifts.length === 0) return null

                return (
                  <div key={dayLabel}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">
                      {dayLabel} {format(dayDate, 'd MMM')}
                    </p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <tbody>
                          {dayShifts.map((s, idx) => (
                            <tr
                              key={s.id}
                              className={cn(
                                'border-b last:border-0',
                                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              )}
                            >
                              <td className="px-2 py-1.5 font-medium text-gray-900">{s.staff_name || '—'}</td>
                              <td className="px-2 py-1.5 text-gray-500">
                                {s.start_time} – {s.end_time}
                              </td>
                              <td className="px-2 py-1.5 text-gray-500 capitalize">{s.role}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">
                                {formatCurrency(s.total_cost / 100)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Notification preview */}
            <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-600 shrink-0" />
              <span className="text-sm text-teal-700">
                <span className="font-semibold">{staffToNotify.length + noShiftStaff.length}</span>{' '}
                staff will be notified
                {noShiftStaff.length > 0 && (
                  <span className="text-teal-500">
                    {' '}(including {noShiftStaff.length} with no shifts)
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* ── Footer navigation ─────────────────────────────────────────────── */}
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <div className="flex gap-2 w-full sm:w-auto sm:mr-auto">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          </div>

          {step < 4 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => (s + 1) as 2 | 3 | 4)}
              disabled={
                (step === 2 && isBudgetHardBlock) ||
                (step === 3 && !canProceedStep3) ||
                (step === 1 && shiftsToPublish.length === 0)
              }
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handlePublish}
              disabled={isPublishing || !canPublish}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isPublishing ? (
                'Publishing…'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publish {shiftsToPublish.length} shift{shiftsToPublish.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
