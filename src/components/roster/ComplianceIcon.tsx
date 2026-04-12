/**
 * ComplianceIcon — inline warning icon shown on shift blocks with violations.
 * Renders a colored dot or triangle with a tooltip listing violations.
 */

import { useMemo } from "react";
import { RosterShift } from "@/types";
import { useRosterStore } from "@/stores/useRosterStore";
import {
  detectRestGapWarnings,
  detectBreakWarnings,
  detectOvertimeWarnings,
} from "@/lib/utils/rosterCalculations";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, AlertCircle } from "lucide-react";

interface ComplianceIconProps {
  shiftId: string;
  className?: string;
}

export function ComplianceIcon({ shiftId, className }: ComplianceIconProps) {
  const { shifts } = useRosterStore();

  const warnings = useMemo(() => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return [];

    const all: { severity: "warning" | "error"; message: string }[] = [];

    // Inline shift warnings (from penalty engine)
    if (shift.warnings) {
      shift.warnings.forEach((w) =>
        all.push({ severity: "warning", message: w }),
      );
    }

    // Rest gap check for this staff member
    const staffShifts = shifts.filter((s) => s.staff_id === shift.staff_id);
    const restWarnings = detectRestGapWarnings(staffShifts).filter(
      (w) => w.shift_id === shiftId,
    );
    restWarnings.forEach((w) =>
      all.push({
        severity: w.severity as "warning" | "error",
        message: w.message,
      }),
    );

    // Break warnings
    const breakWarnings = detectBreakWarnings([shift]);
    breakWarnings.forEach((w) =>
      all.push({
        severity: w.severity as "warning" | "error",
        message: w.message,
      }),
    );

    return all;
  }, [shifts, shiftId]);

  if (warnings.length === 0) return null;

  const hasError = warnings.some((w) => w.severity === "error");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)}>
          {hasError ? (
            <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <ul className="space-y-0.5">
          {warnings.map((w, i) => (
            <li
              key={i}
              className={cn(
                "text-xs",
                w.severity === "error" ? "text-red-200" : "text-orange-200",
              )}
            >
              {w.message}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
