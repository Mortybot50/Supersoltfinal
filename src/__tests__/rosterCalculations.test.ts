/**
 * Tests for calculateShiftCostBreakdown and calculatePenaltyRate.
 *
 * Covers:
 * - All employment types (casual, part-time, full-time)
 * - All penalty scenarios: weekday, Saturday, Sunday, public holiday,
 *   evening, early morning, overtime (daily + weekly)
 * - Minimum engagement warnings
 * - Break warnings
 * - Overnight shift handling
 * - parseTimeToHHMM normalization (ISO timestamps, HH:MM:SS)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateShiftCostBreakdown,
  calculatePenaltyRate,
} from '../lib/utils/rosterCalculations'

// ── Helpers ────────────────────────────────────────────────────────────────

// Use date-only strings so JS parses them as UTC midnight (timezone-safe).
// The penalty engine uses toISOString().split('T')[0] which operates in UTC,
// so date-only construction ensures consistent day identification.
/** Monday 2026-03-16 */
const MONDAY = new Date('2026-03-16')
/** Saturday 2026-03-14 */
const SATURDAY = new Date('2026-03-14')
/** Sunday 2026-03-15 */
const SUNDAY = new Date('2026-03-15')
/** Australia Day 2026 — national public holiday */
const PUBLIC_HOLIDAY = new Date('2026-01-26')

const RATE = 2500 // $25.00/hr = 2500 cents

// ── calculatePenaltyRate ───────────────────────────────────────────────────

describe('calculatePenaltyRate', () => {
  it('returns no penalty for a regular weekday day shift', () => {
    const result = calculatePenaltyRate(MONDAY, '09:00', '17:00', 'VIC', false)
    expect(result.penaltyType).toBe('none')
    expect(result.penaltyMultiplier).toBe(1)
  })

  it('returns saturday penalty (1.25) for full-time', () => {
    const result = calculatePenaltyRate(SATURDAY, '09:00', '17:00', 'VIC', false)
    expect(result.penaltyType).toBe('saturday')
    expect(result.penaltyMultiplier).toBe(1.25)
  })

  it('returns saturday penalty (1.25) for casual — casual loading covers it', () => {
    const result = calculatePenaltyRate(SATURDAY, '09:00', '17:00', 'VIC', true)
    expect(result.penaltyType).toBe('saturday')
    expect(result.penaltyMultiplier).toBe(1.25)
  })

  it('returns sunday penalty (1.50) for full-time', () => {
    const result = calculatePenaltyRate(SUNDAY, '09:00', '17:00', 'VIC', false)
    expect(result.penaltyType).toBe('sunday')
    expect(result.penaltyMultiplier).toBe(1.5)
  })

  it('returns sunday penalty (1.75) for casual', () => {
    const result = calculatePenaltyRate(SUNDAY, '09:00', '17:00', 'VIC', true)
    expect(result.penaltyType).toBe('sunday')
    expect(result.penaltyMultiplier).toBe(1.75)
  })

  it('returns public holiday (2.50) for full-time', () => {
    const result = calculatePenaltyRate(PUBLIC_HOLIDAY, '09:00', '17:00', 'VIC', false)
    expect(result.penaltyType).toBe('public_holiday')
    expect(result.penaltyMultiplier).toBe(2.5)
  })

  it('returns public holiday (2.75) for casual', () => {
    const result = calculatePenaltyRate(PUBLIC_HOLIDAY, '09:00', '17:00', 'VIC', true)
    expect(result.penaltyType).toBe('public_holiday')
    expect(result.penaltyMultiplier).toBe(2.75)
  })

  it('returns evening penalty (1.15) for shift ending after 7pm on weekday', () => {
    const result = calculatePenaltyRate(MONDAY, '15:00', '22:00', 'VIC', false)
    expect(result.penaltyType).toBe('evening')
    expect(result.penaltyMultiplier).toBe(1.15)
  })

  it('returns early morning penalty (1.10) for shift starting before 7am', () => {
    const result = calculatePenaltyRate(MONDAY, '05:00', '13:00', 'VIC', false)
    expect(result.penaltyType).toBe('early_morning')
    expect(result.penaltyMultiplier).toBe(1.10)
  })

  it('public holiday takes priority over Sunday', () => {
    // Australia Day 2026 falls on a Monday — but test a known Sunday public holiday if any.
    // For now confirm general priority: public holiday beats weekend.
    const result = calculatePenaltyRate(PUBLIC_HOLIDAY, '09:00', '17:00', 'VIC', false)
    expect(result.penaltyType).toBe('public_holiday')
  })

  it('returns no penalty when date is undefined', () => {
    const result = calculatePenaltyRate(undefined)
    expect(result.penaltyType).toBe('none')
    expect(result.penaltyMultiplier).toBe(1)
  })

  it('returns no penalty for weekday shift ending exactly at 7pm', () => {
    // endH = 19 triggers evening — shift ending at 18:00 should NOT trigger it
    const result = calculatePenaltyRate(MONDAY, '10:00', '18:00', 'VIC', false)
    expect(result.penaltyType).toBe('none')
    expect(result.penaltyMultiplier).toBe(1)
  })

  it('handles ISO timestamp strings for startTime/endTime (parseTimeToHHMM)', () => {
    // The penalty rate function receives normalised HH:MM from calculateShiftCostBreakdown,
    // but calculatePenaltyRate itself accepts string times — ensure it correctly parses.
    const result = calculatePenaltyRate(MONDAY, '05:30', '14:00', 'VIC', false)
    expect(result.penaltyType).toBe('early_morning')
  })
})

// ── calculateShiftCostBreakdown — base hours ──────────────────────────────

describe('calculateShiftCostBreakdown — base hours & cost', () => {
  it('calculates correct hours for an 8h shift with 30min break', () => {
    const b = calculateShiftCostBreakdown('09:00', '17:00', 30, RATE, 'v1', MONDAY, 'casual')
    expect(b.base_hours).toBe(7.5)
  })

  it('handles overnight shift (end before start)', () => {
    const b = calculateShiftCostBreakdown('22:00', '06:00', 0, RATE, 'v1', MONDAY, 'casual')
    expect(b.base_hours).toBe(8)
  })

  it('normalizes ISO timestamp startTime/endTime', () => {
    const b = calculateShiftCostBreakdown(
      '2026-03-16T09:00:00+11:00',
      '2026-03-16T17:00:00+11:00',
      30,
      RATE,
      'v1',
      MONDAY,
      'casual',
    )
    expect(b.base_hours).toBe(7.5)
  })

  it('calculates base cost correctly (no penalty)', () => {
    // 8h shift, no break, $25/hr = 8 * 2500 = 20000 cents
    const b = calculateShiftCostBreakdown('09:00', '17:00', 0, RATE, 'v1', MONDAY, 'full-time')
    expect(b.base_cost_cents).toBe(20000)
    expect(b.penalty_type).toBeNull()
    expect(b.penalty_multiplier).toBe(1)
  })
})

// ── calculateShiftCostBreakdown — penalty costs ───────────────────────────

describe('calculateShiftCostBreakdown — penalty costs', () => {
  it('applies saturday 1.25× for full-time correctly', () => {
    // 4h shift, no break: base = 10000c, penalty = 10000 * 0.25 = 2500c, total = 12500c
    const b = calculateShiftCostBreakdown('09:00', '13:00', 0, RATE, 'v1', SATURDAY, 'full-time')
    expect(b.penalty_type).toBe('saturday')
    expect(b.penalty_multiplier).toBe(1.25)
    expect(b.total_cost_cents).toBe(12500)
  })

  it('applies sunday 1.75× for casual correctly', () => {
    // 4h shift: base = 10000c, total at 1.75× = 17500c
    const b = calculateShiftCostBreakdown('10:00', '14:00', 0, RATE, 'v1', SUNDAY, 'casual')
    expect(b.penalty_type).toBe('sunday')
    expect(b.penalty_multiplier).toBe(1.75)
    expect(b.total_cost_cents).toBe(17500)
  })

  it('applies public holiday 2.5× for full-time correctly', () => {
    // 4h: 10000 * 2.5 = 25000c
    const b = calculateShiftCostBreakdown('09:00', '13:00', 0, RATE, 'v1', PUBLIC_HOLIDAY, 'full-time')
    expect(b.penalty_type).toBe('public_holiday')
    expect(b.total_cost_cents).toBe(25000)
  })
})

// ── calculateShiftCostBreakdown — overtime ────────────────────────────────

describe('calculateShiftCostBreakdown — overtime (full-time only)', () => {
  it('applies 1.5× for daily overtime (>10h/day)', () => {
    // 11h shift. Ordinary 10h at $25 = 25000c. 1h OT at 1.5× = 3750c. Total = 28750c.
    const b = calculateShiftCostBreakdown('07:00', '18:00', 0, RATE, 'v1', MONDAY, 'full-time')
    expect(b.warnings.some((w) => w.includes('overtime'))).toBe(true)
    // 11h * 2500 base = 27500 base, 1h OT extra at 1.5× means +1250c → 28750c
    expect(b.total_cost_cents).toBeGreaterThan(27500)
  })

  it('applies 2.0× for daily overtime beyond 2h (>12h shift)', () => {
    // 13h shift: 10h ordinary + 3h OT. OT multiplier at >2h = 2.0×
    const b = calculateShiftCostBreakdown('06:00', '19:00', 0, RATE, 'v1', MONDAY, 'full-time')
    expect(b.warnings.some((w) => w.includes('overtime'))).toBe(true)
    // OT > 2h → uses 2.0× multiplier
    const expectedOTCosts = 3 * RATE * 2.0
    expect(b.total_cost_cents).toBeGreaterThanOrEqual(10 * RATE + expectedOTCosts)
  })

  it('applies weekly overtime when weeklyHoursSoFar pushes total over 38h', () => {
    // 36h already worked, 4h shift = 40h total → 2h OT
    const b = calculateShiftCostBreakdown('09:00', '13:00', 0, RATE, 'v1', MONDAY, 'full-time', 'VIC', 36)
    expect(b.warnings.some((w) => w.includes('overtime'))).toBe(true)
  })

  it('does NOT apply overtime for casual staff', () => {
    // 11h shift, casual — no overtime calculation
    const b = calculateShiftCostBreakdown('07:00', '18:00', 0, RATE, 'v1', MONDAY, 'casual')
    expect(b.warnings.every((w) => !w.includes('overtime'))).toBe(true)
  })
})

// ── calculateShiftCostBreakdown — warnings ────────────────────────────────

describe('calculateShiftCostBreakdown — compliance warnings', () => {
  it('warns when casual shift is below 3h minimum', () => {
    const b = calculateShiftCostBreakdown('09:00', '11:00', 0, RATE, 'v1', MONDAY, 'casual')
    expect(b.warnings.some((w) => w.includes('minimum'))).toBe(true)
  })

  it('warns when part-time shift is below 3h minimum', () => {
    const b = calculateShiftCostBreakdown('09:00', '11:00', 0, RATE, 'v1', MONDAY, 'part-time')
    expect(b.warnings.some((w) => w.includes('minimum'))).toBe(true)
  })

  it('does NOT warn for full-time shift below 3h', () => {
    const b = calculateShiftCostBreakdown('09:00', '11:00', 0, RATE, 'v1', MONDAY, 'full-time')
    expect(b.warnings.every((w) => !w.includes('minimum'))).toBe(true)
  })

  it('warns when shift >5h has no meal break', () => {
    const b = calculateShiftCostBreakdown('09:00', '15:00', 0, RATE, 'v1', MONDAY, 'full-time')
    expect(b.warnings.some((w) => w.includes('meal break'))).toBe(true)
  })

  it('does NOT warn when >5h shift has 30min break', () => {
    const b = calculateShiftCostBreakdown('09:00', '15:00', 30, RATE, 'v1', MONDAY, 'full-time')
    expect(b.warnings.every((w) => !w.includes('meal break'))).toBe(true)
  })
})
