# Code Quality Audit — SuperSolt
**Date:** 2026-03-12
**Branch:** fix/skill-audit-sweep

---

## Build Status

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 warnings |
| `npm run build` | ✅ Built in 3.6s |

---

## Summary

| Severity | Count | Fixed | Documented |
|----------|-------|-------|------------|
| Critical | 0     | 0     | 0          |
| High     | 1     | 1     | 0          |
| Medium   | 3     | 0     | 3          |
| Low      | 4     | 0     | 4          |

---

## HIGH

### H1 — `createOpenShift` in dataStore uses non-UUID shift ID
- **File:** `src/lib/store/dataStore.ts` line 2754
- **Issue:** Used `id: \`shift-open-${Date.now()}\`` — not a valid UUID. Would cause a Postgres `invalid input syntax for type uuid` error when this action is eventually connected to the UI and persisted.
- **Fix:** Changed to `crypto.randomUUID()`.
- **Status:** ✅ Fixed

---

## MEDIUM

### M1 — Dead components (not imported anywhere)
- **Files:**
  - `src/components/AvailabilityDialog.tsx`
  - `src/components/ImportWizard.tsx`
  - `src/components/DateRangeSelector.tsx`
- **Issue:** These components exist but are not imported in any page or component.
  - `AvailabilityDialog` is blocked on `staff_availability` DB schema mismatch (missing `specific_date`, `notes`, `is_recurring` columns). Intentionally disconnected until schema is migrated.
  - `ImportWizard` and `DateRangeSelector` appear to be incomplete/planned features.
- **Action:** Do NOT delete — these represent in-progress features. Connect once prerequisites are met.
- **Status:** ⚠️ Documented — blocking conditions tracked in project memory

### M2 — Dead Zustand store actions (Zustand-only, no Supabase persistence)
- **File:** `src/lib/store/dataStore.ts`
- **Actions:**
  - `copyPreviousWeekRoster` (line 413) — copies shifts in memory only; does not persist to DB
  - `claimOpenShift` (line 2732) — updates shift in memory only; no DB write
  - `deleteLaborBudget` (line 2710) — deletes budget in memory only (service `deleteLaborBudgetFromDB` exists in labourService.ts but is not wired up)
- **Issue:** These actions violate ADR-002 (Supabase-first writes). However, they are not currently called from any UI component, so they cause no active data loss.
- **Note:** `claimOpenShift` and `copyPreviousWeekRoster` are feature stubs. `deleteLaborBudget` has a matching DB service but is not connected.
- **Status:** ⚠️ Documented — fix when features are activated

### M3 — `addStaffAvailability` / `updateStaffAvailability` Zustand-only
- **File:** `src/lib/store/dataStore.ts` lines 2572, 2578
- **Issue:** Both are Zustand-only writes. Blocked on `staff_availability` table missing `specific_date`, `notes`, `is_recurring` columns.
- **Note:** Already tracked in project memory. The `AvailabilityDialog` that calls these is also disconnected from any page.
- **Status:** ⚠️ Blocked on schema migration (see database-audit.md M3)

---

## LOW

### L1 — Console statements in catch blocks
- **Files:** Various pages and services
- **Issue:** `console.error(error)` in several catch blocks without contextual message (e.g., `OrderGuide.tsx:300`, `Suppliers.tsx:302`, `PriceTracking.tsx:125`).
- **Impact:** None — these are in error handlers. Sentry captures errors separately via `sentry.ts`. Toast notifications provide user feedback.
- **Status:** ⚠️ Acceptable — low priority cleanup

### L2 — `BulkStaffImport` component has no loading/error state
- **File:** `src/components/BulkStaffImport.tsx` (used in `People.tsx`)
- **Issue:** Imports are fire-and-forget with no loading indicator visible to the user after paste.
- **Status:** ⚠️ UX improvement, out of scope

### L3 — `copyPreviousWeekRoster` date comparison uses `>=` on Date objects
- **File:** `src/lib/store/dataStore.ts` line 422
- **Issue:** `shiftDate >= prevWeekStart` compares Date objects by reference/numeric value. Works correctly in JS but less readable than `getTime()` comparison or `date-fns isWithinInterval`.
- **Status:** ⚠️ No bug, cosmetic only

### L4 — `useEffect` deps: `fetchVenueTemplates(...).then(...).catch(console.error)` in VenueSettings
- **File:** `src/pages/admin/VenueSettings.tsx` line 84
- **Issue:** Passing `console.error` as a catch callback. Passes the Error object directly to console.error, which is fine, but hides the context of which component threw it.
- **Status:** ⚠️ Acceptable, cosmetic
