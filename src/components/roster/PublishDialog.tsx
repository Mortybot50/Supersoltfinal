/**
 * PublishDialog — confirms and publishes the roster for the current week.
 * Shows a preview: shifts to publish, staff notified, total hours/cost.
 */

import { useMemo, useState } from 'react'
import { useRosterStore } from '@/stores/useRosterStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { format, addDays } from 'date-fns'
import { getAllRosterWarnings } from '@/lib/utils/rosterCalculations'
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
import { Send, AlertTriangle, Check, Users, Clock, DollarSign } from 'lucide-react'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PublishDialog({ open, onOpenChange }: PublishDialogProps) {
  const { shifts, availability, selectedDate, publishRoster, staff } = useRosterStore()
  const [isPublishing, setIsPublishing] = useState(false)

  const weekEnd = addDays(selectedDate, 6)

  const weekShifts = useMemo(() => {
    return shifts.filter(s => {
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      return d >= selectedDate && d <= weekEnd
    })
  }, [shifts, selectedDate])

  const draftShifts = weekShifts.filter(s => s.status === 'scheduled')
  const confirmedShifts = weekShifts.filter(s => s.status === 'confirmed')
  const staffToNotify = [...new Set(draftShifts.map(s => s.staff_id))]
  const totalHours = draftShifts.reduce((s, sh) => s + sh.total_hours, 0)
  const totalCost = draftShifts.reduce((s, sh) => s + sh.total_cost, 0)

  const warnings = useMemo(() => getAllRosterWarnings(weekShifts, availability), [weekShifts, availability])

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      await publishRoster(selectedDate)
      onOpenChange(false)
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-teal-500" />
            Publish Roster
          </DialogTitle>
          <DialogDescription>
            {format(selectedDate, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-gray-50 border p-3 flex items-center gap-3">
              <Send className="h-4 w-4 text-teal-500 shrink-0" />
              <div>
                <div className="text-xl font-bold leading-tight">{draftShifts.length}</div>
                <div className="text-xs text-gray-400">shifts to publish</div>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 flex items-center gap-3">
              <Users className="h-4 w-4 text-blue-500 shrink-0" />
              <div>
                <div className="text-xl font-bold leading-tight">{staffToNotify.length}</div>
                <div className="text-xs text-gray-400">staff rostered</div>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 flex items-center gap-3">
              <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
              <div>
                <div className="text-xl font-bold leading-tight">{totalHours.toFixed(1)}h</div>
                <div className="text-xs text-gray-400">total hours</div>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 border p-3 flex items-center gap-3">
              <DollarSign className="h-4 w-4 text-green-500 shrink-0" />
              <div>
                <div className="text-xl font-bold leading-tight">{formatCurrency(totalCost)}</div>
                <div className="text-xs text-gray-400">labour cost</div>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
              <div className="flex items-center gap-2 text-orange-700 mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">{warnings.length} compliance warning{warnings.length > 1 ? 's' : ''}</span>
              </div>
              <p className="text-xs text-orange-600">
                Review compliance issues before publishing. Staff will be notified immediately.
              </p>
            </div>
          )}

          {/* Already published */}
          {confirmedShifts.length > 0 && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm text-green-700">
                {confirmedShifts.length} shift{confirmedShifts.length > 1 ? 's' : ''} already published
              </span>
            </div>
          )}

          {/* No shifts */}
          {draftShifts.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No draft shifts to publish this week
            </div>
          )}

          {/* Staff to notify */}
          {staffToNotify.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Staff to notify</p>
              <div className="flex flex-wrap gap-1.5">
                {staffToNotify.map(id => {
                  const m = staff.find(s => s.id === id)
                  return m ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {m.name}
                    </Badge>
                  ) : null
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handlePublish}
            disabled={isPublishing || draftShifts.length === 0}
            className="bg-teal-500 hover:bg-teal-600"
          >
            {isPublishing ? (
              'Publishing…'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Publish {draftShifts.length} shift{draftShifts.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
