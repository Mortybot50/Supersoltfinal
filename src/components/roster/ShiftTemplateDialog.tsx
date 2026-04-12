/**
 * ShiftTemplateDialog — save and apply shift templates.
 */

import { useState, useMemo } from "react";
import { useRosterStore } from "@/stores/useRosterStore";
import { addShiftTemplateToDB } from "@/lib/services/labourService";
import { ShiftTemplate } from "@/types";
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
import { Save, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ShiftTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply?: (template: ShiftTemplate) => void;
}

export function ShiftTemplateDialog({
  open,
  onOpenChange,
  onApply,
}: ShiftTemplateDialogProps) {
  const { templates, venueId, orgId } = useRosterStore();
  const [tab, setTab] = useState<"list" | "new">("list");
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMins, setBreakMins] = useState("30");
  const [role, setRole] = useState("crew");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Enter a template name");
      return;
    }
    if (!venueId || !orgId) return;

    setIsSaving(true);
    const template: ShiftTemplate = {
      id: `tmpl-${Date.now()}`,
      organization_id: orgId,
      venue_id: venueId,
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      break_minutes: parseInt(breakMins) || 30,
      role: role as "manager" | "supervisor" | "crew",
      days_of_week: [],
      usage_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const saved = await addShiftTemplateToDB(template);
    if (saved) {
      toast.success(`Template "${name}" saved`);
      setTab("list");
      setName("");
    }
    setIsSaving(false);
  };

  const hours = useMemo(() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return Math.max(0, (mins - (parseInt(breakMins) || 0)) / 60);
  }, [startTime, endTime, breakMins]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Shift Templates</DialogTitle>
          <DialogDescription>
            Save and reuse common shift patterns
          </DialogDescription>
        </DialogHeader>

        {/* Tab toggle */}
        <div className="flex rounded-md border overflow-hidden mb-2">
          <button
            onClick={() => setTab("list")}
            className={`flex-1 py-1.5 text-sm font-medium transition-colors ${tab === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            Saved ({templates.length})
          </button>
          <button
            onClick={() => setTab("new")}
            className={`flex-1 py-1.5 text-sm font-medium transition-colors ${tab === "new" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            New Template
          </button>
        </div>

        {tab === "list" && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                No saved templates. Create one above.
              </div>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50"
                >
                  <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-xs text-gray-400">
                      {t.start_time}–{t.end_time} • {t.break_minutes}min break •{" "}
                      <span className="capitalize">{t.role}</span>
                    </div>
                  </div>
                  {onApply && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => {
                        onApply(t);
                        onOpenChange(false);
                      }}
                    >
                      Apply
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "new" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="tmpl-name" className="text-xs">
                Template Name
              </Label>
              <Input
                id="tmpl-name"
                placeholder="e.g., Weekend Dinner, Monday Opener"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Start</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">End</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Break (min)</Label>
                <Input
                  type="number"
                  value={breakMins}
                  onChange={(e) => setBreakMins(e.target.value)}
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 h-8 text-sm w-full rounded-md border border-input bg-background px-2"
              >
                <option value="crew">Crew</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            {hours > 0 && (
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {hours.toFixed(1)}h working time
              </Badge>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {tab === "new" && (
            <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving…" : "Save Template"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
