/**
 * ShiftContextMenu — right-click / three-dot context menu for a ShiftBlock.
 * Provides: see costs, edit breaks, copy/paste, duplicate, repeat, leave, delete.
 */

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  MoreHorizontal,
  DollarSign,
  Clock,
  Copy,
  ClipboardPaste,
  ChevronsRight,
  Repeat2,
  Calendar,
  Trash2,
} from 'lucide-react'
import { RosterShift } from '@/types'
import { useRosterStore } from '@/stores/useRosterStore'
import { addDays } from 'date-fns'
import { cn } from '@/lib/utils'

interface ShiftContextMenuProps {
  shift: RosterShift
  onSeeCosts: () => void
}

export function ShiftContextMenu({ shift, onSeeCosts }: ShiftContextMenuProps) {
  const {
    copiedShift, setCopiedShift,
    addShift, updateShift, deleteShift,
  } = useRosterStore()

  const [showBreakEditor, setShowBreakEditor] = useState(false)
  const [showRepeatDialog, setShowRepeatDialog] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [breakMinutes, setBreakMinutes] = useState(shift.break_minutes)
  const [breakPaid, setBreakPaid] = useState(shift.break_minutes === 0)
  const [repeatWeeks, setRepeatWeeks] = useState(1)

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCopy = () => setCopiedShift(shift)

  const handlePaste = () => {
    if (!copiedShift) return
    const shiftDate = shift.date instanceof Date ? shift.date : new Date(shift.date)
    addShift({
      ...copiedShift,
      staff_id: shift.staff_id,
      staff_name: shift.staff_name,
      date: shiftDate,
      status: 'scheduled',
    })
  }

  const handleDuplicateToTomorrow = () => {
    const base = shift.date instanceof Date ? shift.date : new Date(shift.date)
    addShift({
      ...shift,
      date: addDays(base, 1),
      status: 'scheduled',
    })
  }

  const handleRepeatWeekly = () => {
    const base = shift.date instanceof Date ? shift.date : new Date(shift.date)
    for (let i = 1; i <= repeatWeeks; i++) {
      addShift({
        ...shift,
        date: addDays(base, i * 7),
        status: 'scheduled',
      })
    }
    setShowRepeatDialog(false)
  }

  const handleSaveBreaks = () => {
    updateShift(shift.id, { break_minutes: breakPaid ? 0 : breakMinutes })
    setShowBreakEditor(false)
  }

  const handleDelete = () => {
    deleteShift(shift.id)
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={e => e.stopPropagation()}
            className={cn(
              'absolute top-0.5 right-0.5 h-5 w-5 rounded',
              'flex items-center justify-center',
              'opacity-0 group-hover:opacity-100 sm:opacity-100 md:opacity-0 md:group-hover:opacity-100',
              'hover:bg-black/10 transition-opacity z-20',
            )}
            aria-label="Shift options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" onClick={e => e.stopPropagation()}>
          <DropdownMenuItem onClick={onSeeCosts}>
            <DollarSign className="h-3.5 w-3.5 mr-2" />
            See Costs
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowBreakEditor(true)}>
            <Clock className="h-3.5 w-3.5 mr-2" />
            Edit Breaks
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5 mr-2" />
            Copy Shift
          </DropdownMenuItem>
          {copiedShift && (
            <DropdownMenuItem onClick={handlePaste}>
              <ClipboardPaste className="h-3.5 w-3.5 mr-2" />
              Paste Shift
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleDuplicateToTomorrow}>
            <ChevronsRight className="h-3.5 w-3.5 mr-2" />
            Duplicate to Tomorrow
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowRepeatDialog(true)}>
            <Repeat2 className="h-3.5 w-3.5 mr-2" />
            Repeat Weekly
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {/* TODO: open leave dialog pre-filled */}}>
            <Calendar className="h-3.5 w-3.5 mr-2" />
            Create Leave
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Break Editor ────────────────────────────────────────────────────── */}
      <Dialog open={showBreakEditor} onOpenChange={setShowBreakEditor}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Edit Break</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Switch
                id="break-paid"
                checked={breakPaid}
                onCheckedChange={checked => {
                  setBreakPaid(checked)
                  if (checked) setBreakMinutes(0)
                }}
              />
              <Label htmlFor="break-paid">Paid break (no deduction)</Label>
            </div>
            {!breakPaid && (
              <div className="space-y-1.5">
                <Label htmlFor="break-minutes">Duration (minutes)</Label>
                <Input
                  id="break-minutes"
                  type="number"
                  min={0}
                  max={120}
                  value={breakMinutes}
                  onChange={e => setBreakMinutes(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBreakEditor(false)}>Cancel</Button>
            <Button onClick={handleSaveBreaks}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Repeat Weekly ───────────────────────────────────────────────────── */}
      <Dialog open={showRepeatDialog} onOpenChange={setShowRepeatDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Repeat Weekly</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="repeat-weeks">Repeat for next</Label>
            <div className="flex items-center gap-2">
              <Input
                id="repeat-weeks"
                type="number"
                min={1}
                max={8}
                value={repeatWeeks}
                onChange={e => setRepeatWeeks(Math.min(8, Math.max(1, Number(e.target.value))))}
                className="w-20"
              />
              <span className="text-sm text-gray-500">weeks</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRepeatDialog(false)}>Cancel</Button>
            <Button onClick={handleRepeatWeekly}>Repeat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ─────────────────────────────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete Shift</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Delete this shift for <strong>{shift.staff_name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
