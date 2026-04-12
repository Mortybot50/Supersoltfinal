/**
 * ComplianceSummary — panel showing all compliance warnings for the visible week.
 * Grouped by type: overtime, rest gaps, break violations, availability conflicts.
 */

import { useMemo } from "react";
import { useRosterStore } from "@/stores/useRosterStore";
import { getAllRosterWarnings } from "@/lib/utils/rosterCalculations";
import { RosterWarning } from "@/types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  X,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  rest_gap: "Rest Gap",
  break_required: "Break Required",
  overtime_weekly: "Weekly Overtime",
  overtime_daily: "Daily Overtime",
  availability_conflict: "Availability Conflict",
  minor_hours: "Min. Engagement",
  budget_exceeded: "Budget Exceeded",
};

interface ComplianceSummaryProps {
  onClose?: () => void;
}

export function ComplianceSummary({ onClose }: ComplianceSummaryProps) {
  const { shifts, availability } = useRosterStore();

  const warnings = useMemo(
    () => getAllRosterWarnings(shifts, availability),
    [shifts, availability],
  );

  const errors = warnings.filter((w) => w.severity === "error");
  const warningsOnly = warnings.filter((w) => w.severity === "warning");

  if (warnings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4">
        <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
        <p className="text-sm font-medium text-green-700">All clear</p>
        <p className="text-xs text-gray-400 mt-0.5">
          No compliance issues for this week
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">Compliance</span>
          {errors.length > 0 && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1">
              {errors.length} errors
            </Badge>
          )}
          {warningsOnly.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1 text-orange-600 border-orange-300"
            >
              {warningsOnly.length} warnings
            </Badge>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto max-h-64">
        {/* Errors first */}
        {errors.length > 0 && (
          <div className="border-b">
            <div className="px-3 py-1.5 bg-red-50">
              <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wide">
                Errors — must fix
              </span>
            </div>
            {errors.map((w) => (
              <WarningRow key={w.id} warning={w} />
            ))}
          </div>
        )}

        {/* Warnings */}
        {warningsOnly.length > 0 && (
          <div>
            <div className="px-3 py-1.5 bg-orange-50">
              <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide">
                Warnings
              </span>
            </div>
            {warningsOnly.map((w) => (
              <WarningRow key={w.id} warning={w} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WarningRow({ warning }: { warning: RosterWarning }) {
  const isError = warning.severity === "error";
  const typeLabel = TYPE_LABELS[warning.type] || warning.type;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3 py-2 border-b last:border-b-0",
        "hover:bg-gray-50 transition-colors",
      )}
    >
      {isError ? (
        <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium truncate">
            {warning.staff_name}
          </span>
          <Badge
            variant="outline"
            className="text-[9px] h-3.5 px-1 border-gray-200 text-gray-500 shrink-0"
          >
            {typeLabel}
          </Badge>
        </div>
        <p className="text-[11px] text-gray-500 leading-tight">
          {warning.message}
        </p>
      </div>
    </div>
  );
}
