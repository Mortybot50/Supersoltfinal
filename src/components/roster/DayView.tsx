/**
 * DayView — Gantt-style day view with POS demand overlay.
 *
 * Layout (top-to-bottom):
 *   1. Demand Graph (200px)   — AreaChart: rostered vs POS demand vs actual
 *   2. Summary Stats Bar      — hours, recommended, variance, cost
 *   3. Timeline Grid          — horizontal shift bars per staff member
 *
 * Mobile (< md): simplified shift list, no Gantt.
 */

import { useMemo, useRef, useCallback } from "react";
import { isSameDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useRosterStore } from "@/stores/useRosterStore";
import { useAuth } from "@/contexts/AuthContext";
import { DayDemandChart } from "./DayDemandChart";
import { useDemandForecast } from "@/lib/hooks/useDemandForecast";
import {
  calculateHourlyStaffing,
  calculateDayStats,
  formatLabourCost,
  formatTimeCompact,
  formatHours,
  getRoleColor,
} from "@/lib/utils/rosterCalculations";
import { RosterShift } from "@/types";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMELINE_START = 6; // 6am
const TIMELINE_END = 23; // 11pm
const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START;

const ROLE_BADGE_LABELS: Record<string, string> = {
  manager: "MGR",
  management: "MGR",
  supervisor: "SUP",
  crew: "CRW",
  kitchen: "KIT",
  foh: "FOH",
  bar: "BAR",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayViewProps {
  onAddShift?: (date: Date, staffId: string) => void;
  onSelectShift?: (shift: RosterShift) => void;
  onDeleteShift?: (shift: RosterShift) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getShiftPosition(startTime: string, endTime: string) {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let startPos = startH + startM / 60;
  let endPos = endH + endM / 60;
  if (endPos <= startPos) endPos += 24;

  startPos = Math.max(startPos, TIMELINE_START);
  endPos = Math.min(endPos, TIMELINE_END);

  const left = ((startPos - TIMELINE_START) / TIMELINE_RANGE) * 100;
  const width = ((endPos - startPos) / TIMELINE_RANGE) * 100;

  return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
}

function getBreakPosition(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): { left: string; width: string } | null {
  if (breakMinutes <= 0) return null;

  // Estimate break at mid-shift
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMins = startH * 60 + startM;
  let endMins = endH * 60 + endM;
  if (endMins <= startMins) endMins += 24 * 60;

  const midMins = (startMins + endMins) / 2;
  const breakStart = midMins - breakMinutes / 2;
  const breakEnd = midMins + breakMinutes / 2;

  const breakStartH = Math.max(breakStart / 60, TIMELINE_START);
  const breakEndH = Math.min(breakEnd / 60, TIMELINE_END);
  const shiftStartH = Math.max(startMins / 60, TIMELINE_START);
  const shiftEndH = Math.min(endMins / 60, TIMELINE_END);
  const shiftWidth = shiftEndH - shiftStartH;

  if (shiftWidth <= 0) return null;

  const leftPct = ((breakStartH - shiftStartH) / shiftWidth) * 100;
  const widthPct = ((breakEndH - breakStartH) / shiftWidth) * 100;

  return {
    left: `${Math.max(0, leftPct)}%`,
    width: `${Math.max(0, widthPct)}%`,
  };
}

function timelineHours() {
  const hours = [];
  for (let h = TIMELINE_START; h <= TIMELINE_END; h++) {
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    hours.push({ hour: h, label: `${h12}${ampm}` });
  }
  return hours;
}

const HOURS = timelineHours();

// ── Drag-to-resize hook ───────────────────────────────────────────────────────

function useShiftResize(
  shift: RosterShift,
  containerRef: React.RefObject<HTMLDivElement>,
  onUpdate: (id: string, updates: Partial<RosterShift>) => void,
) {
  const dragging = useRef<{
    type: "start" | "end";
    startX: number;
    originalTime: string;
  } | null>(null);

  const onMouseDown = useCallback(
    (type: "start" | "end") => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      dragging.current = {
        type,
        startX: e.clientX,
        originalTime: type === "start" ? shift.start_time : shift.end_time,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dx = ev.clientX - dragging.current.startX;
        const pxPerHour = rect.width / TIMELINE_RANGE;
        const deltaHours = dx / pxPerHour;
        const deltaMins = Math.round((deltaHours * 60) / 30) * 30; // snap to 30 min

        const [origH, origM] = dragging.current.originalTime
          .split(":")
          .map(Number);
        let newMins = origH * 60 + origM + deltaMins;
        // Clamp to operating hours
        newMins = Math.max(
          TIMELINE_START * 60,
          Math.min(TIMELINE_END * 60, newMins),
        );
        const newH = Math.floor(newMins / 60)
          .toString()
          .padStart(2, "0");
        const newM = (newMins % 60).toString().padStart(2, "0");
        const newTime = `${newH}:${newM}`;

        if (dragging.current.type === "start" && newTime < shift.end_time) {
          onUpdate(shift.id, { start_time: newTime });
        } else if (
          dragging.current.type === "end" &&
          newTime > shift.start_time
        ) {
          onUpdate(shift.id, { end_time: newTime });
        }
      };

      const onMouseUp = () => {
        dragging.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [shift, containerRef, onUpdate],
  );

  return { onMouseDown };
}

// ── ShiftBar subcomponent ─────────────────────────────────────────────────────

interface ShiftBarProps {
  shift: RosterShift;
  containerRef: React.RefObject<HTMLDivElement>;
  onSelect: (shift: RosterShift) => void;
  onUpdate: (id: string, updates: Partial<RosterShift>) => void;
  staffName: string;
  role: string;
}

function ShiftBar({
  shift,
  containerRef,
  onSelect,
  onUpdate,
  staffName,
  role,
}: ShiftBarProps) {
  const pos = getShiftPosition(shift.start_time, shift.end_time);
  const breakPos = getBreakPosition(
    shift.start_time,
    shift.end_time,
    shift.break_minutes,
  );
  const roleColor = getRoleColor(role);
  const roleBadge = ROLE_BADGE_LABELS[role.toLowerCase()] ?? "CRW";
  const { onMouseDown } = useShiftResize(shift, containerRef, onUpdate);

  return (
    <div className="flex items-center h-10 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      {/* Staff info */}
      <div className="w-48 shrink-0 flex items-center gap-1.5 px-3 border-r">
        <Badge
          className={`${roleColor.bg} text-white text-[9px] px-1.5 py-0 h-5 font-bold shrink-0`}
        >
          {roleBadge}
        </Badge>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium truncate leading-tight">
            {staffName}
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight">
            {formatTimeCompact(shift.start_time)}–
            {formatTimeCompact(shift.end_time)}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div ref={containerRef} className="flex-1 relative h-full">
        {/* Hour grid lines */}
        <div className="absolute inset-0 flex pointer-events-none">
          {HOURS.map(({ hour }) => (
            <div
              key={hour}
              className="flex-1 border-r border-gray-100 dark:border-gray-800"
            />
          ))}
        </div>

        {/* Shift bar */}
        <div
          className={cn(
            "absolute top-1.5 h-7 rounded cursor-pointer select-none",
            "flex items-center overflow-hidden transition-opacity hover:opacity-90",
            roleColor.bg,
          )}
          style={{ left: pos.left, width: pos.width }}
          onClick={() => onSelect(shift)}
        >
          {/* Break overlay (lighter section) */}
          {breakPos && (
            <div
              className="absolute top-0 h-full opacity-50 bg-white/60"
              style={{ left: breakPos.left, width: breakPos.width }}
              title={`${shift.break_minutes}min break`}
            />
          )}

          {/* Left drag handle */}
          <div
            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize z-10 group"
            onMouseDown={onMouseDown("start")}
          >
            <div className="w-0.5 h-full bg-white/50 group-hover:bg-white mx-auto" />
          </div>

          {/* Label */}
          <span className="relative z-0 text-[10px] text-white font-medium px-2 truncate">
            {shift.total_hours.toFixed(1)}h ·{" "}
            {formatLabourCost(shift.total_cost)}
          </span>

          {/* Right drag handle */}
          <div
            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-10 group"
            onMouseDown={onMouseDown("end")}
          >
            <div className="w-0.5 h-full bg-white/50 group-hover:bg-white mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile list view ──────────────────────────────────────────────────────────

function MobileShiftList({
  shifts,
  onSelect,
}: {
  shifts: RosterShift[];
  onSelect: (shift: RosterShift) => void;
}) {
  return (
    <div className="divide-y">
      {shifts.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No shifts scheduled for this day
        </div>
      )}
      {shifts.map((shift) => {
        const roleColor = getRoleColor(shift.role);
        const roleBadge =
          ROLE_BADGE_LABELS[shift.role?.toLowerCase() ?? ""] ?? "CRW";
        return (
          <button
            key={shift.id}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
            onClick={() => onSelect(shift)}
          >
            <Badge
              className={`${roleColor.bg} text-white text-[9px] px-1.5 py-0 h-5 font-bold shrink-0`}
            >
              {roleBadge}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {shift.staff_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatTimeCompact(shift.start_time)} –{" "}
                {formatTimeCompact(shift.end_time)}
                {shift.break_minutes > 0 &&
                  ` · ${shift.break_minutes}min break`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-medium">
                {shift.total_hours.toFixed(1)}h
              </div>
              <div className="text-xs text-muted-foreground">
                {formatLabourCost(shift.total_cost)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DayView({ onSelectShift }: DayViewProps) {
  const { currentVenue } = useAuth();
  const { selectedDate, shifts, updateShift, selectShift } = useRosterStore();

  // Filter to selected day only
  const dayShifts = useMemo(
    () =>
      shifts
        .filter(
          (s) =>
            !s.is_open_shift &&
            s.status !== "cancelled" &&
            isSameDay(
              s.date instanceof Date ? s.date : new Date(s.date),
              selectedDate,
            ),
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [shifts, selectedDate],
  );

  // Hourly staffing + day stats for the demand chart
  const hourlyStaffing = useMemo(
    () => calculateHourlyStaffing(shifts, selectedDate),
    [shifts, selectedDate],
  );
  const dayStats = useMemo(
    () => calculateDayStats(shifts, selectedDate),
    [shifts, selectedDate],
  );

  // POS demand from orders table
  const { data: posSlots } = useDemandForecast(
    currentVenue?.id ?? null,
    selectedDate,
  );

  // Summary stats
  const recommendedHours = useMemo(
    () =>
      posSlots ? posSlots.reduce((sum, s) => sum + s.demandStaff * 0.5, 0) : 0,
    [posSlots],
  );
  const variance = dayStats.totalHours - recommendedHours;
  const variancePct =
    recommendedHours > 0 ? (Math.abs(variance) / recommendedHours) * 100 : null;
  const varianceColor =
    variancePct === null
      ? "text-muted-foreground"
      : variancePct <= 10
        ? "text-green-600"
        : variancePct <= 20
          ? "text-amber-500"
          : "text-red-500";

  // Per-row containerRef map (for drag-to-resize hit detection)
  const containerRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(
    new Map(),
  );
  function getContainerRef(shiftId: string): React.RefObject<HTMLDivElement> {
    if (!containerRefs.current.has(shiftId)) {
      containerRefs.current.set(shiftId, { current: null });
    }
    return containerRefs.current.get(shiftId)!;
  }

  const handleSelect = useCallback(
    (shift: RosterShift) => {
      selectShift(shift.id);
      onSelectShift?.(shift);
    },
    [selectShift, onSelectShift],
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<RosterShift>) => {
      updateShift(id, updates);
    },
    [updateShift],
  );

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
      {/* ── Demand Graph ───────────────────────────────────────── */}
      <div className="border-b p-4">
        <DayDemandChart
          hourlyStaffing={hourlyStaffing}
          dayStats={dayStats}
          posSlots={posSlots ?? undefined}
        />
      </div>

      {/* ── Summary Stats Bar ──────────────────────────────────── */}
      <div className="border-b px-4 py-2 flex items-center gap-6 bg-gray-50 dark:bg-gray-900 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Rostered</span>
          <span className="font-semibold tabular-nums">
            {formatHours(dayStats.totalHours)}
          </span>
        </div>
        {posSlots && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Recommended</span>
              <span className="font-semibold tabular-nums">
                {formatHours(recommendedHours)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Variance</span>
              <span className={cn("font-semibold tabular-nums", varianceColor)}>
                {variance >= 0 ? "+" : ""}
                {formatHours(Math.abs(variance))}
                {variancePct !== null && (
                  <span className="ml-1 text-[10px] font-normal">
                    ({variancePct.toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Day cost</span>
          <span className="font-semibold tabular-nums">
            {formatLabourCost(dayStats.totalCost)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Staff</span>
          <span className="font-semibold tabular-nums">
            {dayStats.staffCount}
          </span>
        </div>
      </div>

      {/* ── Timeline Grid — hidden on mobile ──────────────────── */}
      <div className="hidden md:block">
        {/* Time axis header */}
        <div className="flex border-b ml-48 sticky top-0 bg-white dark:bg-gray-800 z-10">
          {HOURS.map(({ hour, label }) => (
            <div
              key={hour}
              className="flex-1 text-center text-[10px] text-muted-foreground py-1 border-r"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Shift rows */}
        <div className="divide-y">
          {dayShifts.map((shift) => {
            const containerRef = getContainerRef(shift.id);
            return (
              <ShiftBar
                key={shift.id}
                shift={shift}
                containerRef={containerRef as React.RefObject<HTMLDivElement>}
                onSelect={handleSelect}
                onUpdate={handleUpdate}
                staffName={shift.staff_name || "Unknown"}
                role={shift.role || "crew"}
              />
            );
          })}

          {dayShifts.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No shifts scheduled for this day
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile list view ─────────────────────────────────── */}
      <div className="md:hidden">
        <MobileShiftList shifts={dayShifts} onSelect={handleSelect} />
      </div>
    </div>
  );
}
