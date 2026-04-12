/**
 * Award Rate Service — Simplified AU Restaurant Industry Award 2020 (MA000119)
 *
 * ⚠️ ESTIMATED ONLY — This is NOT a full Fair Work compliant engine.
 * Real award interpretation requires specialist development (~$15–20K).
 *
 * Covers:
 * - Day-based penalty multipliers (weekday, Saturday, Sunday, public holiday)
 * - Casual loading (+25%)
 * - Evening penalty (after 7pm weekdays) — interface built, not used for QSR venues
 * - Overtime (full-time >38h/week or >10h/day)
 * - Minimum engagement warnings
 *
 * Does NOT cover:
 * - Split shifts, broken shifts
 * - Allowances (uniform, travel, first aid)
 * - Higher duties
 * - Annual leave loading
 * - Specific award classification levels (Level 1–6)
 * - Junior rates
 * - Apprentice rates
 */

import { AU_HOSPITALITY_PENALTY_RATES } from "@/types";
import { calculatePenaltyRate } from "@/lib/utils/rosterCalculations";

// ── Types ────────────────────────────────────────────────────────────────────

export type EmploymentType = "full-time" | "part-time" | "casual";

export interface AwardRateInput {
  baseHourlyRateCents: number;
  employmentType: EmploymentType;
  shiftDate: Date;
  startTime: string;
  endTime: string;
  state?: string;
}

export interface AwardRateResult {
  /** The effective hourly rate in cents (base × multipliers) */
  effectiveRateCents: number;
  /** The base hourly rate in cents (before any loadings) */
  baseRateCents: number;
  /** Penalty multiplier applied (1.0 = no penalty) */
  penaltyMultiplier: number;
  /** Human-readable list of loadings applied */
  loadings: string[];
  /** Penalty type identifier */
  penaltyType: string;
  /** Always true — this is an estimate, not a certified calculation */
  isEstimate: true;
}

export interface ShiftCostEstimate {
  /** Total estimated cost in cents */
  totalCostCents: number;
  /** Base cost (hours × base rate) in cents */
  baseCostCents: number;
  /** Additional penalty cost in cents */
  penaltyCostCents: number;
  /** Effective hours (after break deduction) */
  effectiveHours: number;
  /** Award rate breakdown */
  rate: AwardRateResult;
  /** Always true */
  isEstimate: true;
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Calculate the effective hourly rate for a shift based on AU award rules.
 *
 * Uses the existing penalty rate engine in rosterCalculations.ts
 * and wraps it with a cleaner interface.
 */
export function calculateEffectiveRate(input: AwardRateInput): AwardRateResult {
  const {
    baseHourlyRateCents,
    employmentType,
    shiftDate,
    startTime,
    endTime,
    state = "VIC",
  } = input;

  const isCasual = employmentType === "casual";
  const loadings: string[] = [];

  // Get penalty from existing engine
  const { penaltyType, penaltyMultiplier } = calculatePenaltyRate(
    shiftDate,
    startTime,
    endTime,
    state,
    isCasual,
  );

  // Build loadings description
  if (isCasual) {
    loadings.push("Casual loading +25%");
  }

  if (penaltyType !== "none" && penaltyMultiplier > 1) {
    const pctExtra = Math.round((penaltyMultiplier - 1) * 100);
    const labels: Record<string, string> = {
      saturday: `Saturday penalty +${pctExtra}%`,
      sunday: `Sunday penalty +${pctExtra}%`,
      public_holiday: `Public holiday penalty +${pctExtra}%`,
      evening: `Evening penalty +${pctExtra}%`,
      early_morning: `Early morning penalty +${pctExtra}%`,
      late_night: `Late night penalty +${pctExtra}%`,
    };
    loadings.push(labels[penaltyType] || `Penalty +${pctExtra}%`);
  }

  // For casuals: base rate already includes 25% loading in the award system
  // The penalty multiplier from calculatePenaltyRate already accounts for casual rates
  // (e.g. casual_sunday = 1.75 vs permanent sunday = 1.50)
  let effectiveRateCents: number;

  if (isCasual) {
    // Casual base rate = base × 1.25 (casual loading)
    // Penalty applies on top of the loaded rate for Sunday/PH
    const casualBase = Math.round(
      baseHourlyRateCents * AU_HOSPITALITY_PENALTY_RATES.casual_loading,
    );
    effectiveRateCents = Math.round(casualBase * penaltyMultiplier);
  } else {
    effectiveRateCents = Math.round(baseHourlyRateCents * penaltyMultiplier);
  }

  return {
    effectiveRateCents,
    baseRateCents: baseHourlyRateCents,
    penaltyMultiplier,
    loadings,
    penaltyType,
    isEstimate: true,
  };
}

/**
 * Calculate the total estimated cost for a shift.
 */
export function calculateShiftCostEstimate(
  input: AwardRateInput & { breakMinutes: number },
): ShiftCostEstimate {
  const { startTime, endTime, breakMinutes } = input;

  // Calculate effective hours
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let totalMinutes = endH * 60 + endM - (startH * 60 + startM);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const effectiveHours = Math.max(0, (totalMinutes - breakMinutes) / 60);

  // Get rate
  const rate = calculateEffectiveRate(input);

  // Calculate costs
  const baseCostCents = Math.round(effectiveHours * input.baseHourlyRateCents);
  const totalCostCents = Math.round(effectiveHours * rate.effectiveRateCents);
  const penaltyCostCents = totalCostCents - baseCostCents;

  return {
    totalCostCents,
    baseCostCents,
    penaltyCostCents: Math.max(0, penaltyCostCents),
    effectiveHours,
    rate,
    isEstimate: true,
  };
}

/**
 * Get the default base hourly rate for an employment type (when staff has no rate set).
 * Based on Restaurant Industry Award Level 1 (intro) rates as of July 2024.
 *
 * These are MINIMUM award rates — most venues pay above award.
 */
export function getDefaultAwardRateCents(
  employmentType: EmploymentType,
): number {
  // Level 1 (Food Services Employee Grade 1) minimum rates (approx)
  switch (employmentType) {
    case "full-time":
    case "part-time":
      return 2418; // $24.18/hr base (permanent)
    case "casual":
      return 2418; // $24.18/hr base (casual loading applied separately)
    default:
      return 2418;
  }
}

/**
 * Get a human-readable summary of what loadings apply to a date.
 */
export function getDateLoadingSummary(
  date: Date,
  employmentType: EmploymentType,
  state: string = "VIC",
): string {
  const isCasual = employmentType === "casual";
  const { penaltyType, penaltyMultiplier } = calculatePenaltyRate(
    date,
    "09:00",
    "17:00",
    state,
    isCasual,
  );

  const parts: string[] = [];
  if (isCasual) parts.push("Casual +25%");

  const labels: Record<string, string> = {
    saturday: "Saturday penalty",
    sunday: "Sunday penalty",
    public_holiday: "Public holiday",
    evening: "Evening penalty",
    early_morning: "Early morning",
  };

  if (penaltyType !== "none") {
    const label = labels[penaltyType] || penaltyType;
    parts.push(`${label} (${Math.round(penaltyMultiplier * 100)}%)`);
  }

  return parts.length > 0 ? parts.join(" + ") : "Base rate";
}
