/**
 * ShiftCreateDialog — compact dialog shown after drag-and-drop
 * to configure shift details before creation.
 */

import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Clock, X } from 'lucide-react'

interface PendingShiftInfo {
  staffId: string
  staffName: string
  date: Date
  defaultRole: string
  venueId: string
  employmentType: 'full-time' | 'part-time' | 'casual'
  hourlyRateCents: number
}

interface ShiftConfig {
  startTime: string
  endTime: string
  role: string
  breakMinutes: number
}

interface ShiftCreateDialogProps {
  pendingShift: PendingShiftInfo | null
  onConfirm: (config: ShiftConfig) => void
  onCancel: () => void
}

const PRESETS: { label: string; start: string; end: string }[] = [
  { label: 'Open', start: '06:00', end: '14:00' },
  { label: 'Mid', start: '10:00', end: '18:00' },
  { label: 'Close', start: '14:00', end: '22:00' },
]

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${h.toString().padStart(2, '0')}:${m}`
})

const ROLES = ['kitchen', 'bar', 'foh', 'management'] as const

const BREAK_OPTIONS = [0, 15, 30, 45, 60] as const

export function ShiftCreateDialog({ pendingShift, onConfirm, onCancel }: ShiftCreateDialogProps) {
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [role, setRole] = useState(pendingShift?.defaultRole || 'foh')
  const [breakMinutes, setBreakMinutes] = useState(30)

  // Reset state when a new pending shift opens
  const [lastStaffId, setLastStaffId] = useState<string | null>(null)
  if (pendingShift && pendingShift.staffId !== lastStaffId) {
    setStartTime('09:00')
    setEndTime('17:00')
    setRole(pendingShift.defaultRole || 'foh')
    setBreakMinutes(30)
    setLastStaffId(pendingShift.staffId)
  }

  const applyPreset = useCallback((start: string, end: string) => {
    setStartTime(start)
    setEndTime(end)
  }, [])

  const handleConfirm = useCallback(() => {
    onConfirm({ startTime, endTime, role, breakMinutes })
  }, [startTime, endTime, role, breakMinutes, onConfirm])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleConfirm()
    }
  }, [handleConfirm])

  const formatDateLabel = (d: Date) => {
    const safe = d instanceof Date ? d : new Date(d)
    return safe.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <Dialog open={!!pendingShift} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[380px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            New Shift
          </DialogTitle>
          {pendingShift && (
            <p className="text-sm text-muted-foreground">
              {pendingShift.staffName} — {formatDateLabel(pendingShift.date)}
            </p>
          )}
        </DialogHeader>

        {/* Quick presets */}
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => applyPreset(p.start, p.end)}
            >
              {p.label}
              <span className="ml-1 text-muted-foreground">
                {p.start.replace(':00', '')}-{p.end.replace(':00', '')}
              </span>
            </Button>
          ))}
        </div>

        <div className="grid gap-3">
          {/* Start / End times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="shift-start" className="text-xs">Start</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="shift-start" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-end" className="text-xs">End</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="shift-end" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1">
            <Label htmlFor="shift-role" className="text-xs">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="shift-role" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Break duration */}
          <div className="space-y-1">
            <Label htmlFor="shift-break" className="text-xs">Break</Label>
            <Select value={String(breakMinutes)} onValueChange={(v) => setBreakMinutes(Number(v))}>
              <SelectTrigger id="shift-break" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BREAK_OPTIONS.map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    {b === 0 ? 'No break' : `${b} min`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="mr-1 h-3 w-3" /> Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Create Shift
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { PendingShiftInfo, ShiftConfig }
