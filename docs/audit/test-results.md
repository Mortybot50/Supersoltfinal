# Test Results — SuperSolt
**Date:** 2026-03-12
**Branch:** fix/skill-audit-sweep

---

## Test Run Summary

```
Test Files  3 passed (3)
Tests       58 passed (58)
Duration    ~220ms
```

All 58 tests pass after two fixes applied in this audit:
1. **Public holiday UTC/local date bug** — `calculatePenaltyRate` and `isPublicHoliday` used `toISOString().split('T')[0]` which returns UTC date. In AEST/AEDT timezone (UTC+10/11), midnight local time becomes the previous day in UTC, causing all public holiday checks to fail. Fixed to use `getFullYear() / getMonth() / getDate()` (local time).
2. **Orphaned SuperSoltMVP-main tests** — vitest was picking up test files in the unrelated `SuperSoltMVP-main/` subdirectory which depend on `drizzle-orm` and `@testing-library/react` (not installed). Fixed by adding `include`/`exclude` patterns to vitest config.

---

## Test Coverage by Module

### `rosterCalculations.test.ts` — 29 tests ✅

**`calculatePenaltyRate`** (all day/time combos):
- ✅ Weekday day shift → no penalty
- ✅ Saturday → 1.25× full-time, 1.25× casual (casual loading covers it)
- ✅ Sunday → 1.50× full-time, 1.75× casual
- ✅ Public holiday → 2.50× full-time, 2.75× casual (WAS FAILING — fixed)
- ✅ Public holiday priority over Sunday (WAS FAILING — fixed)
- ✅ Evening (end after 7pm) → 1.15×
- ✅ Early morning (start before 7am) → 1.10×
- ✅ Undefined date → no penalty (safe fallback)
- ✅ 7pm boundary → no penalty (not strictly after)
- ✅ ISO timestamp input normalization via `parseTimeToHHMM`

**`calculateShiftCostBreakdown`** (all employment types):
- ✅ Base hours with 30min break (8h shift → 7.5h paid)
- ✅ Overnight shift (end time < start time)
- ✅ ISO timestamp normalization (DB timestamptz format)
- ✅ Base cost without penalty
- ✅ Saturday 1.25× for full-time
- ✅ Sunday 1.75× for casual
- ✅ Public holiday 2.5× for full-time (WAS FAILING — fixed)
- ✅ Daily overtime 1.5× for >10h shift
- ✅ Daily overtime 2.0× for >12h shift
- ✅ Weekly overtime when cumulative hours exceed 38h
- ✅ No overtime applied for casual staff
- ✅ 3h minimum casual engagement warning
- ✅ 3h minimum part-time warning
- ✅ No 3h warning for full-time
- ✅ Meal break warning (>5h with 0 min break)
- ✅ No break warning when 30min break included

### `unitConversions.test.ts` — 17 tests ✅

**Recipe cost calculation with unit conversions:**
- ✅ `convertQtyToBaseUnits`: g/kg/ml/L/each conversions
- ✅ `calculatePackToBaseFactor`: pack size to per-unit cost
- ✅ `calculateCostPerBaseUnit`: purchase unit cost → recipe unit cost
- ✅ `calculateLineCost`: recipe ingredient line cost (qty × cost_per_base_unit × conversion)
- ✅ Cross-unit system conversions (volume, weight, count)
- ✅ Edge cases: zero quantities, 1:1 conversions

### `orderCalculations.test.ts` — 12 tests ✅

**Order guide par levels:**
- ✅ `calculateRecommendedQuantity`: safety stock + lead time demand
- ✅ `determineUrgency`: critical/low/ok thresholds from par levels
- ✅ `calculateGST`: GST-inclusive vs exclusive price calculations

---

## Fixes Applied

### Bug Fix: Public holiday UTC/local date mismatch
- **File:** `src/lib/utils/rosterCalculations.ts`
- **Functions fixed:** `calculatePenaltyRate`, `isPublicHoliday`, `getPublicHolidayName`
- **Impact:** In production (AEST/AEDT timezone), public holiday detection was silently broken for any shift starting at midnight or shortly after. Staff rostered on Australia Day, Christmas, ANZAC Day etc. were being calculated at base rate instead of 2.5× rate — an underpayment compliance risk.

### Config Fix: Exclude orphaned SuperSoltMVP-main tests
- **File:** `vite.config.ts`
- **Change:** Added `include: ["src/**/*.test.{ts,tsx}"]` and explicit `exclude` for `SuperSoltMVP-main/**`
- **Reason:** The `SuperSoltMVP-main/` subdirectory contains tests for a different project stack (Drizzle ORM + Express) that were being picked up and failing on missing packages.

---

## Integration Test Flows (Pending)

The following integration flows require a live Supabase test environment and are documented as pending:

| Flow | Status | Blocker |
|------|--------|---------|
| Staff creation (API route) | ⚠️ Pending | Needs Supabase test DB / mock |
| Shift CRUD + DB persistence | ⚠️ Pending | Needs Supabase test DB |
| Roster publish flow | ⚠️ Pending | Needs Supabase test DB |
| Stock count → inventory deduction | ⚠️ Pending | Needs Supabase test DB |

**Recommendation:** Set up a `SUPABASE_TEST_URL` + `SUPABASE_TEST_ANON_KEY` pointing to a separate Supabase project (free tier) for integration testing. Use `vitest` with `beforeAll` to seed test data and `afterAll` to clean up.
