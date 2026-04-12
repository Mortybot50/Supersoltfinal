/**
 * RoleGroupHeader — collapsible section header for a role group.
 * Shows role name, staff count, total hours, total cost for the visible week.
 */

import { RosterShift } from "@/types";
import { getRoleColors } from "@/stores/useRosterStore";
import { formatCurrency } from "@/lib/utils/formatters";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleGroupHeaderProps {
  role: string;
  staffCount: number;
  shifts: RosterShift[];
  isExpanded: boolean;
  onToggle: () => void;
  /** Number of date columns so header spans them all */
  colCount: number;
}

export function RoleGroupHeader({
  role,
  staffCount,
  shifts,
  isExpanded,
  onToggle,
  colCount,
}: RoleGroupHeaderProps) {
  const colors = getRoleColors(role);
  const activeShifts = shifts.filter((s) => s.status !== "cancelled");
  const totalHours = activeShifts.reduce((s, sh) => s + sh.total_hours, 0);
  const totalCost = activeShifts.reduce((s, sh) => s + sh.total_cost, 0);

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none",
        "sticky left-0 z-10",
        colors.bg,
        "border-b border-t",
        colors.border,
        "hover:brightness-95 transition-all",
      )}
      style={{ gridColumn: `1 / span ${colCount + 2}` }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onToggle()}
    >
      {/* Chevron */}
      {isExpanded ? (
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0", colors.text)} />
      ) : (
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0", colors.text)} />
      )}

      {/* Role dot + name */}
      <div className={cn("h-2 w-2 rounded-full shrink-0", colors.dot)} />
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wide capitalize",
          colors.text,
        )}
      >
        {role}
      </span>

      {/* Staff count */}
      <span className={cn("text-xs opacity-60", colors.text)}>
        {staffCount} {staffCount === 1 ? "person" : "people"}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Subtotals */}
      <div className="flex items-center gap-3 text-xs">
        <span className={cn("opacity-70", colors.text)}>
          {totalHours.toFixed(1)}h
        </span>
        {totalCost > 0 && (
          <span className={cn("font-medium", colors.text)}>
            {formatCurrency(totalCost)}
          </span>
        )}
      </div>
    </div>
  );
}
