/**
 * AutoFillDialog — auto-fill the roster using last week as a template,
 * filtered by staff availability.
 */

import { useState, useMemo } from "react";
import { useRosterStore } from "@/stores/useRosterStore";
import { formatTimeCompact } from "@/lib/utils/rosterCalculations";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wand2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { RosterShift } from "@/types";

interface AutoFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoFillDialog({ open, onOpenChange }: AutoFillDialogProps) {
  const { ghostShifts, shifts, staff, availability, selectedDate, addShift } =
    useRosterStore();
  const [isRunning, setIsRunning] = useState(false);
  const [preview, setPreview] = useState<RosterShift[] | null>(null);

  // Build a preview of shifts to create based on last week's ghost shifts
  const buildPreview = useMemo(() => {
    const weekEnd = addDays(selectedDate, 6);

    return ghostShifts
      .map((ghost) => {
        const ghostDate =
          ghost.date instanceof Date ? ghost.date : new Date(ghost.date);
        // Map to same day-of-week in current week
        const dayOfWeek = ghostDate.getDay(); // 0=Sun, 1=Mon, ...
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 offset
        const targetDate = addDays(selectedDate, diff);

        if (targetDate > weekEnd) return null;

        // Check if shift already exists for this staff on this day
        const alreadyScheduled = shifts.some((s) => {
          const d = s.date instanceof Date ? s.date : new Date(s.date);
          return (
            s.staff_id === ghost.staff_id &&
            d.toDateString() === targetDate.toDateString() &&
            s.status !== "cancelled"
          );
        });
        if (alreadyScheduled) return null;

        // Check availability
        const staffMember = staff.find((s) => s.id === ghost.staff_id);
        if (!staffMember || staffMember.status !== "active") return null;

        const dayOfWeekTarget = targetDate.getDay();
        const isUnavailable = availability.some(
          (a) =>
            a.staff_id === ghost.staff_id &&
            a.type === "unavailable" &&
            a.is_recurring &&
            a.day_of_week === dayOfWeekTarget,
        );
        if (isUnavailable) return null;

        return {
          ...ghost,
          id: `autofill-${ghost.id}-${Date.now()}`,
          date: targetDate,
          status: "scheduled" as const,
        };
      })
      .filter(Boolean) as RosterShift[];
  }, [ghostShifts, shifts, staff, availability, selectedDate]);

  const handlePreview = () => setPreview(buildPreview);

  const handleApply = async () => {
    if (!preview || preview.length === 0) return;
    setIsRunning(true);
    try {
      for (const shift of preview) {
        await addShift(shift);
      }
      toast.success(
        `Auto-filled ${preview.length} shift${preview.length > 1 ? "s" : ""} from last week`,
      );
      onOpenChange(false);
      setPreview(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setPreview(null);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-500" />
            Auto-fill from Last Week
          </DialogTitle>
          <DialogDescription>
            Copy last week's shifts to this week, skipping staff who are
            unavailable or already scheduled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!preview ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
                <p className="text-sm text-purple-700">
                  Found <strong>{ghostShifts.length}</strong> shifts from last
                  week. Auto-fill will:
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-purple-600 list-disc list-inside">
                  <li>Skip staff with marked unavailability</li>
                  <li>Skip days already scheduled</li>
                  <li>Create all shifts as drafts (not published)</li>
                </ul>
              </div>
              <Button
                onClick={handlePreview}
                disabled={ghostShifts.length === 0}
                className="w-full bg-purple-500 hover:bg-purple-600"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Preview Auto-fill
              </Button>
              {ghostShifts.length === 0 && (
                <p className="text-xs text-gray-400 text-center">
                  No shifts from last week to copy
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {preview.length} shift{preview.length !== 1 ? "s" : ""} to
                  create
                </span>
                <Badge variant="outline" className="text-xs">
                  {ghostShifts.length - preview.length} skipped
                </Badge>
              </div>

              {preview.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  All shifts already scheduled or staff unavailable
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {preview.map((s, i) => {
                    const d =
                      s.date instanceof Date ? s.date : new Date(s.date);
                    const member = staff.find((m) => m.id === s.staff_id);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border bg-gray-50"
                      >
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="font-medium w-16 shrink-0">
                          {format(d, "EEE d MMM")}
                        </span>
                        <span className="truncate">
                          {member?.name || s.staff_name}
                        </span>
                        <span className="text-gray-400 ml-auto shrink-0">
                          {formatTimeCompact(s.start_time)}–
                          {formatTimeCompact(s.end_time)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                onClick={() => setPreview(null)}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                ← Change settings
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setPreview(null);
            }}
          >
            Cancel
          </Button>
          {preview !== null && preview.length > 0 && (
            <Button
              onClick={handleApply}
              disabled={isRunning}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {isRunning ? "Applying…" : `Apply ${preview.length} Shifts`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
