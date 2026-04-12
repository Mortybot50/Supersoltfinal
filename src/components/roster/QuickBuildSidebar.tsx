/**
 * QuickBuildSidebar — bulk roster construction tools.
 * 480px right-hand slide-over with 4 accordion sections:
 *   1. Templates     — save/apply multi-shift week templates
 *   2. Copy Shifts   — last week, specific week, single day copy
 *   3. Roster Patterns — recurring weekly shift patterns (CRUD + apply)
 *   4. Auto-Fill     — copy_last, assign_open, build_empty
 */

import { useState, useMemo } from "react";
import { useRosterStore } from "@/stores/useRosterStore";
import { TemplateShiftDef } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BookTemplate,
  Copy,
  RefreshCw,
  Wand2,
  Plus,
  Trash2,
  Play,
  AlertTriangle,
  Check,
  ChevronRight,
} from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { toast } from "sonner";
import {
  formatTimeCompact,
  getWeekStart,
} from "@/lib/utils/rosterCalculations";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROLES = ["crew", "supervisor", "manager", "kitchen", "bar", "foh"];

// ─────────────────────────────────────────────────────────────────────────────

export function QuickBuildSidebar() {
  const {
    quickBuildOpen,
    setQuickBuildOpen,
    templates,
    selectedDate,
    rosterPatterns,
    staff,
    copyWeekShifts,
    copyDayShifts,
    autoFill,
    saveCurrentAsTemplate,
    applyRosterTemplate,
    addRosterPattern,
    updateRosterPattern,
    deleteRosterPattern,
    applyRosterPattern: applyPattern,
    shifts,
  } = useRosterStore();

  return (
    <Sheet open={quickBuildOpen} onOpenChange={setQuickBuildOpen}>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-purple-500" />
            Quick Build
          </SheetTitle>
          <SheetDescription className="text-xs">
            Bulk roster construction — {format(selectedDate, "d MMM")}–
            {format(addDays(selectedDate, 6), "d MMM yyyy")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Accordion
            type="multiple"
            defaultValue={["templates", "copy"]}
            className="w-full"
          >
            {/* ── Section 1: Templates ── */}
            <TemplatesSection
              templates={templates}
              selectedDate={selectedDate}
              shifts={shifts}
              onApply={applyRosterTemplate}
              onSaveCurrent={saveCurrentAsTemplate}
            />

            {/* ── Section 2: Copy Shifts ── */}
            <CopyShiftsSection
              selectedDate={selectedDate}
              onCopyWeek={copyWeekShifts}
              onCopyDay={copyDayShifts}
            />

            {/* ── Section 3: Roster Patterns ── */}
            <PatternsSection
              patterns={rosterPatterns}
              staff={staff}
              venueId={useRosterStore.getState().venueId || ""}
              orgId={useRosterStore.getState().orgId || ""}
              onAdd={addRosterPattern}
              onUpdate={updateRosterPattern}
              onDelete={deleteRosterPattern}
              onApply={applyPattern}
            />

            {/* ── Section 4: Auto-Fill ── */}
            <AutoFillSection onAutoFill={autoFill} />
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 — Templates
// ─────────────────────────────────────────────────────────────────────────────

interface TemplatesSectionProps {
  templates: ReturnType<typeof useRosterStore>["templates"];
  selectedDate: Date;
  shifts: ReturnType<typeof useRosterStore>["shifts"];
  onApply: (
    t: ReturnType<typeof useRosterStore>["templates"][0],
  ) => Promise<{ created: number; conflicts: number }>;
  onSaveCurrent: (name: string) => Promise<boolean>;
}

function TemplatesSection({
  templates,
  selectedDate,
  shifts,
  onApply,
  onSaveCurrent,
}: TemplatesSectionProps) {
  const [saveName, setSaveName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<
    (typeof templates)[0] | null
  >(null);

  const weekEnd = addDays(selectedDate, 6);
  const weekShiftCount = shifts.filter((s) => {
    const d = s.date instanceof Date ? s.date : new Date(s.date);
    return d >= selectedDate && d <= weekEnd && s.status !== "cancelled";
  }).length;

  const handleSave = async () => {
    if (!saveName.trim()) {
      toast.error("Enter a template name");
      return;
    }
    setIsSaving(true);
    const ok = await onSaveCurrent(saveName.trim());
    if (ok) {
      setSaveName("");
      setShowSaveForm(false);
    }
    setIsSaving(false);
  };

  const handleApply = async (t: (typeof templates)[0]) => {
    setApplyingId(t.id);
    const { created, conflicts } = await onApply(t);
    setApplyingId(null);
    setConfirmTemplate(null);
    if (created > 0) {
      toast.success(
        `Applied "${t.name}": ${created} shift${created !== 1 ? "s" : ""} created${conflicts > 0 ? `, ${conflicts} skipped (conflicts)` : ""}`,
      );
    } else if (conflicts > 0) {
      toast.warning(
        `All ${conflicts} shifts skipped — conflicts with existing schedule`,
      );
    } else {
      toast.info("No shifts to create from this template");
    }
  };

  const templateShiftCount = (t: (typeof templates)[0]) => {
    if (t.template_shifts && t.template_shifts.length > 0)
      return t.template_shifts.length;
    return t.days_of_week.length;
  };

  const templateHours = (t: (typeof templates)[0]) => {
    const shifts =
      t.template_shifts && t.template_shifts.length > 0
        ? t.template_shifts
        : t.days_of_week.map(() => ({
            start_time: t.start_time,
            end_time: t.end_time,
            break_minutes: t.break_minutes,
          }));
    return shifts.reduce((sum, s) => {
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      let mins = eh * 60 + em - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      return sum + Math.max(0, (mins - s.break_minutes) / 60);
    }, 0);
  };

  return (
    <AccordionItem value="templates" className="border-b">
      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <BookTemplate className="h-4 w-4 text-blue-500" />
          Templates
          {templates.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {templates.length}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
        {/* Save current week */}
        {!showSaveForm ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            onClick={() => setShowSaveForm(true)}
            disabled={weekShiftCount === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            Save Current Week as Template
            {weekShiftCount > 0 && (
              <span className="text-gray-400">({weekShiftCount} shifts)</span>
            )}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="Template name…"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              className="h-8 text-xs px-3"
              onClick={handleSave}
              disabled={isSaving || !saveName.trim()}
            >
              {isSaving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-2"
              onClick={() => {
                setShowSaveForm(false);
                setSaveName("");
              }}
            >
              ✕
            </Button>
          </div>
        )}

        {/* Template list */}
        {templates.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">
            No templates yet. Save the current week to create one.
          </p>
        ) : (
          <div className="space-y-1.5">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 p-2.5 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {templateShiftCount(t)} shift
                    {templateShiftCount(t) !== 1 ? "s" : ""}
                    {" · "}
                    {templateHours(t).toFixed(1)}h total
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0 gap-1"
                  onClick={() => setConfirmTemplate(t)}
                  disabled={applyingId === t.id}
                >
                  {applyingId === t.id ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-3 w-3" /> Apply
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Apply confirmation dialog */}
        <Dialog
          open={!!confirmTemplate}
          onOpenChange={(v) => !v && setConfirmTemplate(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Apply Template</DialogTitle>
              <DialogDescription>
                This will create{" "}
                <strong>
                  {confirmTemplate ? templateShiftCount(confirmTemplate) : 0}
                </strong>{" "}
                shifts in the current week. Conflicts with existing shifts will
                be skipped.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              <span className="font-medium">{confirmTemplate?.name}</span>
              <br />
              <span className="text-xs text-gray-400">
                {confirmTemplate
                  ? `${templateShiftCount(confirmTemplate)} shifts · ${templateHours(confirmTemplate).toFixed(1)}h total`
                  : ""}
              </span>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmTemplate(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => confirmTemplate && handleApply(confirmTemplate)}
                disabled={!!applyingId}
              >
                {applyingId ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Apply Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 — Copy Shifts
// ─────────────────────────────────────────────────────────────────────────────

interface CopyShiftsSectionProps {
  selectedDate: Date;
  onCopyWeek: (
    sourceWeekStart: Date,
  ) => Promise<{ created: number; conflicts: number }>;
  onCopyDay: (
    sourceDate: Date,
    targetDates: Date[],
  ) => Promise<{ created: number; conflicts: number }>;
}

function CopyShiftsSection({
  selectedDate,
  onCopyWeek,
  onCopyDay,
}: CopyShiftsSectionProps) {
  const [isCopyingLastWeek, setIsCopyingLastWeek] = useState(false);
  const [isCopyingSpecific, setIsCopyingSpecific] = useState(false);
  const [isCopyingDay, setIsCopyingDay] = useState(false);
  const [specificWeekDate, setSpecificWeekDate] = useState("");
  const [sourceDayDate, setSourceDayDate] = useState("");
  const [targetDays, setTargetDays] = useState<number[]>([]);

  const prevWeekStart = addDays(selectedDate, -7);

  const handleCopyLastWeek = async () => {
    setIsCopyingLastWeek(true);
    const { created, conflicts } = await onCopyWeek(prevWeekStart);
    setIsCopyingLastWeek(false);
    if (created === 0 && conflicts === 0) {
      toast.info("No shifts found in the previous week");
    } else {
      toast.success(
        `Copied ${created} shift${created !== 1 ? "s" : ""}${conflicts > 0 ? `, ${conflicts} skipped (conflicts)` : ""}`,
      );
    }
  };

  const handleCopySpecificWeek = async () => {
    if (!specificWeekDate) {
      toast.error("Select a source week");
      return;
    }
    const sourceDate = new Date(specificWeekDate + "T00:00:00");
    const sourceWeekStart = getWeekStart(sourceDate);
    setIsCopyingSpecific(true);
    const { created, conflicts } = await onCopyWeek(sourceWeekStart);
    setIsCopyingSpecific(false);
    if (created === 0 && conflicts === 0) {
      toast.info("No shifts found in that week");
    } else {
      toast.success(
        `Copied ${created} shift${created !== 1 ? "s" : ""}${conflicts > 0 ? `, ${conflicts} skipped (conflicts)` : ""}`,
      );
    }
  };

  const handleCopyDay = async () => {
    if (!sourceDayDate) {
      toast.error("Select a source day");
      return;
    }
    if (targetDays.length === 0) {
      toast.error("Select at least one target day");
      return;
    }

    const sourceDate = new Date(sourceDayDate + "T00:00:00");
    const targets = targetDays.map((offset) => addDays(selectedDate, offset));

    setIsCopyingDay(true);
    const { created, conflicts } = await onCopyDay(sourceDate, targets);
    setIsCopyingDay(false);
    if (created === 0 && conflicts === 0) {
      toast.info("No shifts found on that day");
    } else {
      toast.success(
        `Copied ${created} shift${created !== 1 ? "s" : ""}${conflicts > 0 ? `, ${conflicts} skipped (conflicts)` : ""}`,
      );
    }
    setTargetDays([]);
  };

  const toggleTargetDay = (offset: number) => {
    setTargetDays((prev) =>
      prev.includes(offset)
        ? prev.filter((d) => d !== offset)
        : [...prev, offset],
    );
  };

  // Week days (Mon–Sun, offset 0–6)
  const weekDays = Array.from({ length: 7 }, (_, i) => ({
    offset: i,
    label: format(addDays(selectedDate, i), "EEE d"),
  }));

  return (
    <AccordionItem value="copy" className="border-b">
      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Copy className="h-4 w-4 text-green-500" />
          Copy Shifts
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1 space-y-4">
        {/* Copy from last week */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Last Week
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg border bg-gray-50">
            <div>
              <div className="text-sm font-medium">Copy from last week</div>
              <div className="text-xs text-gray-400">
                {format(prevWeekStart, "d MMM")}–
                {format(addDays(prevWeekStart, 6), "d MMM")}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 shrink-0"
              onClick={handleCopyLastWeek}
              disabled={isCopyingLastWeek}
            >
              {isCopyingLastWeek ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Copy from specific week */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Specific Week
          </div>
          <div className="flex gap-2">
            <Input
              type="date"
              value={specificWeekDate}
              onChange={(e) => setSpecificWeekDate(e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-3 shrink-0 gap-1"
              onClick={handleCopySpecificWeek}
              disabled={isCopyingSpecific || !specificWeekDate}
            >
              {isCopyingSpecific ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Select any day within the source week.
          </p>
        </div>

        {/* Copy single day */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Single Day
          </div>
          <div>
            <Label className="text-xs text-gray-500">Source day</Label>
            <Input
              type="date"
              value={sourceDayDate}
              onChange={(e) => setSourceDayDate(e.target.value)}
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">
              Copy to (current week)
            </Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {weekDays.map(({ offset, label }) => (
                <button
                  key={offset}
                  onClick={() => toggleTargetDay(offset)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                    targetDays.includes(offset)
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {sourceDayDate && targetDays.length > 0 && (
            <p className="text-xs text-blue-600">
              Will copy{" "}
              {format(new Date(sourceDayDate + "T00:00:00"), "EEE d MMM")} →{" "}
              {targetDays.length} day{targetDays.length !== 1 ? "s" : ""}
            </p>
          )}
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1"
            onClick={handleCopyDay}
            disabled={isCopyingDay || !sourceDayDate || targetDays.length === 0}
          >
            {isCopyingDay ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy Day
              </>
            )}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 — Roster Patterns
// ─────────────────────────────────────────────────────────────────────────────

interface PatternsSectionProps {
  patterns: ReturnType<typeof useRosterStore>["rosterPatterns"];
  staff: ReturnType<typeof useRosterStore>["staff"];
  venueId: string;
  orgId: string;
  onAdd: (
    p: Parameters<ReturnType<typeof useRosterStore>["addRosterPattern"]>[0],
  ) => Promise<boolean>;
  onUpdate: ReturnType<typeof useRosterStore>["updateRosterPattern"];
  onDelete: ReturnType<typeof useRosterStore>["deleteRosterPattern"];
  onApply: (id: string) => Promise<{ created: number; conflicts: number }>;
}

function PatternsSection({
  patterns,
  staff,
  venueId,
  orgId,
  onAdd,
  onUpdate,
  onDelete,
  onApply,
}: PatternsSectionProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApply = async (id: string, name: string) => {
    setApplyingId(id);
    const { created, conflicts } = await onApply(id);
    setApplyingId(null);
    if (created > 0) {
      toast.success(
        `Pattern "${name}": ${created} shift${created !== 1 ? "s" : ""} created${conflicts > 0 ? `, ${conflicts} skipped` : ""}`,
      );
    } else if (conflicts > 0) {
      toast.warning(`All shifts skipped — conflicts with existing schedule`);
    } else {
      toast.info("No shifts to create from this pattern");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await onDelete(id);
    if (ok) toast.success(`Pattern "${name}" deleted`);
  };

  return (
    <AccordionItem value="patterns" className="border-b">
      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-teal-500" />
          Roster Patterns
          {patterns.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
              {patterns.length}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1 space-y-3">
        <p className="text-xs text-gray-500">
          Recurring shift patterns applied each week (e.g., "Mon–Wed–Fri Kitchen
          Open").
        </p>

        {/* Pattern list */}
        {patterns.length === 0 && !showNewForm ? (
          <p className="text-xs text-gray-400 text-center py-2">
            No patterns yet. Create one below.
          </p>
        ) : (
          <div className="space-y-1.5">
            {patterns.map((p) => (
              <div key={p.id} className="rounded-lg border bg-gray-50">
                <div className="flex items-center gap-2 p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.shifts.length} shift{p.shifts.length !== 1 ? "s" : ""}
                      {p.shifts.length > 0 && (
                        <>
                          {" "}
                          ·{" "}
                          {[
                            ...new Set(
                              p.shifts.map((s) => DAY_NAMES[s.day_of_week]),
                            ),
                          ].join(", ")}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        setEditingId(editingId === p.id ? null : p.id)
                      }
                      title="Edit pattern"
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          editingId === p.id && "rotate-90",
                        )}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleApply(p.id, p.name)}
                      disabled={applyingId === p.id}
                    >
                      {applyingId === p.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Play className="h-3 w-3" /> Apply
                        </>
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(p.id, p.name)}
                      title="Delete pattern"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Inline edit: show shift definitions */}
                {editingId === p.id && (
                  <PatternEditor
                    pattern={p}
                    staff={staff}
                    onSave={(updates) => onUpdate(p.id, updates)}
                    onClose={() => setEditingId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* New pattern form */}
        {showNewForm ? (
          <NewPatternForm
            staff={staff}
            venueId={venueId}
            onSave={async (pattern) => {
              const ok = await onAdd(pattern);
              if (ok) setShowNewForm(false);
            }}
            onCancel={() => setShowNewForm(false)}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            onClick={() => setShowNewForm(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Roster Pattern
          </Button>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pattern Editor (inline edit for existing patterns)
// ─────────────────────────────────────────────────────────────────────────────

interface PatternEditorProps {
  pattern: ReturnType<typeof useRosterStore>["rosterPatterns"][0];
  staff: ReturnType<typeof useRosterStore>["staff"];
  onSave: (updates: {
    name?: string;
    shifts?: TemplateShiftDef[];
  }) => Promise<boolean>;
  onClose: () => void;
}

function PatternEditor({
  pattern,
  staff,
  onSave,
  onClose,
}: PatternEditorProps) {
  const [name, setName] = useState(pattern.name);
  const [shifts, setShifts] = useState<TemplateShiftDef[]>(pattern.shifts);
  const [isSaving, setIsSaving] = useState(false);

  const addShift = () => {
    setShifts((prev) => [
      ...prev,
      {
        day_of_week: 1,
        start_time: "09:00",
        end_time: "17:00",
        break_minutes: 30,
        role: "crew",
        staff_id: null,
      },
    ]);
  };

  const removeShift = (i: number) => {
    setShifts((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateShift = (i: number, updates: Partial<TemplateShiftDef>) => {
    setShifts((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...updates } : s)),
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await onSave({ name, shifts });
    setIsSaving(false);
    if (ok) {
      toast.success("Pattern updated");
      onClose();
    }
  };

  return (
    <div className="border-t px-3 pb-3 pt-2 space-y-2">
      <div>
        <Label className="text-xs text-gray-500">Pattern name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-7 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Shift definitions</Label>
        {shifts.map((s, i) => (
          <ShiftDefRow
            key={i}
            shiftDef={s}
            staff={staff}
            onChange={(updates) => updateShift(i, updates)}
            onRemove={() => removeShift(i)}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={addShift}
        >
          <Plus className="h-3 w-3" /> Add shift
        </Button>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? (
            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          Save
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Pattern Form
// ─────────────────────────────────────────────────────────────────────────────

interface NewPatternFormProps {
  staff: ReturnType<typeof useRosterStore>["staff"];
  venueId: string;
  onSave: (
    pattern: Parameters<
      ReturnType<typeof useRosterStore>["addRosterPattern"]
    >[0],
  ) => Promise<void>;
  onCancel: () => void;
}

function NewPatternForm({
  staff,
  venueId,
  onSave,
  onCancel,
}: NewPatternFormProps) {
  const [name, setName] = useState("");
  const [shifts, setShifts] = useState<TemplateShiftDef[]>([
    {
      day_of_week: 1,
      start_time: "09:00",
      end_time: "17:00",
      break_minutes: 30,
      role: "crew",
      staff_id: null,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const orgId = useRosterStore.getState().orgId || "";

  const addShift = () => {
    setShifts((prev) => [
      ...prev,
      {
        day_of_week: 1,
        start_time: "09:00",
        end_time: "17:00",
        break_minutes: 30,
        role: "crew",
        staff_id: null,
      },
    ]);
  };

  const removeShift = (i: number) =>
    setShifts((prev) => prev.filter((_, idx) => idx !== i));

  const updateShift = (i: number, updates: Partial<TemplateShiftDef>) => {
    setShifts((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...updates } : s)),
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Enter a pattern name");
      return;
    }
    if (shifts.length === 0) {
      toast.error("Add at least one shift");
      return;
    }
    setIsSaving(true);
    await onSave({
      organization_id: orgId,
      venue_id: venueId,
      name: name.trim(),
      shifts,
      is_active: true,
    });
    setIsSaving(false);
  };

  return (
    <div className="border rounded-lg p-3 bg-white space-y-2.5">
      <div className="text-xs font-medium text-gray-600">New Pattern</div>
      <div>
        <Label className="text-xs text-gray-500">Pattern name</Label>
        <Input
          autoFocus
          placeholder="e.g., Mon-Wed-Fri Kitchen Open"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-8 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">Shift definitions</Label>
        {shifts.map((s, i) => (
          <ShiftDefRow
            key={i}
            shiftDef={s}
            staff={staff}
            onChange={(updates) => updateShift(i, updates)}
            onRemove={shifts.length > 1 ? () => removeShift(i) : undefined}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={addShift}
        >
          <Plus className="h-3 w-3" /> Add shift
        </Button>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? (
            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          Save Pattern
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shift Definition Row (used in both editor and new form)
// ─────────────────────────────────────────────────────────────────────────────

interface ShiftDefRowProps {
  shiftDef: TemplateShiftDef;
  staff: ReturnType<typeof useRosterStore>["staff"];
  onChange: (updates: Partial<TemplateShiftDef>) => void;
  onRemove?: () => void;
}

function ShiftDefRow({
  shiftDef,
  staff,
  onChange,
  onRemove,
}: ShiftDefRowProps) {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-1 items-center">
      {/* Day of week */}
      <select
        value={shiftDef.day_of_week}
        onChange={(e) => onChange({ day_of_week: Number(e.target.value) })}
        className="h-7 text-xs rounded-md border border-input bg-background px-1.5"
      >
        {DAY_NAMES.map((d, i) => (
          <option key={i} value={i}>
            {d}
          </option>
        ))}
      </select>
      {/* Start time */}
      <Input
        type="time"
        value={shiftDef.start_time}
        onChange={(e) => onChange({ start_time: e.target.value })}
        className="h-7 text-xs px-1.5"
      />
      {/* End time */}
      <Input
        type="time"
        value={shiftDef.end_time}
        onChange={(e) => onChange({ end_time: e.target.value })}
        className="h-7 text-xs px-1.5"
      />
      {/* Role */}
      <select
        value={shiftDef.role}
        onChange={(e) => onChange({ role: e.target.value })}
        className="h-7 text-xs rounded-md border border-input bg-background px-1.5 capitalize"
      >
        {ROLES.map((r) => (
          <option key={r} value={r} className="capitalize">
            {r}
          </option>
        ))}
      </select>
      {/* Remove */}
      {onRemove ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      ) : (
        <div className="h-7 w-7" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 — Auto-Fill
// ─────────────────────────────────────────────────────────────────────────────

interface AutoFillSectionProps {
  onAutoFill: (
    mode: "copy_last" | "assign_open" | "build_empty",
  ) => Promise<void>;
}

function AutoFillSection({ onAutoFill }: AutoFillSectionProps) {
  const [running, setRunning] = useState<string | null>(null);

  const run = async (mode: "copy_last" | "assign_open" | "build_empty") => {
    setRunning(mode);
    await onAutoFill(mode);
    setRunning(null);
  };

  const actions = [
    {
      mode: "copy_last" as const,
      icon: <Copy className="h-4 w-4 text-blue-500" />,
      title: "Fill from Last Week",
      description:
        "Copy last week's roster, skip unavailable staff, flag gaps.",
    },
    {
      mode: "assign_open" as const,
      icon: <Wand2 className="h-4 w-4 text-purple-500" />,
      title: "Assign Staff to Open Shifts",
      description:
        "Match available staff to open shifts. Prefers staff who worked the slot last week, then balances hours.",
    },
    {
      mode: "build_empty" as const,
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      title: "Build Empty Roster",
      description:
        "Generate shift slots from demand data — requires sales forecasting setup.",
    },
  ];

  return (
    <AccordionItem value="autofill" className="border-b">
      <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-purple-500" />
          Auto-Fill
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-1 space-y-2">
        <p className="text-xs text-gray-500 mb-1">
          All operations create shifts as drafts (not published).
        </p>
        {actions.map(({ mode, icon, title, description }) => (
          <div
            key={mode}
            className="flex gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{description}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0 self-center"
              onClick={() => run(mode)}
              disabled={!!running}
            >
              {running === mode ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Run"
              )}
            </Button>
          </div>
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}
