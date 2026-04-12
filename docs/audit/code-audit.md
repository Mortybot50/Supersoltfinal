# Code Quality Audit — SuperSolt

**Date:** 2026-03-12
**Branch:** fix/skill-audit-sweep

---

## Build Status

| Check              | Result                  |
| ------------------ | ----------------------- |
| `npx tsc --noEmit` | ✅ 0 errors             |
| `npm run lint`     | ✅ 0 errors, 0 warnings |
| `npm run build`    | ✅ Built in ~3.7s       |

---

## Summary

| Severity  | Count  | Fixed | Documented Only |
| --------- | ------ | ----- | --------------- |
| Critical  | 3      | 3     | 0               |
| High      | 1      | 1     | 0               |
| Medium    | 3      | 1     | 2               |
| Low       | 4      | 0     | 4               |
| **Total** | **11** | **5** | **6**           |

---

## CRITICAL

### C1 — `useMemo` called conditionally in `InventoryInsights.tsx::AlertsPanel`

- **File:** `src/pages/insights/InventoryInsights.tsx` line 131
- **Issue:** React Hooks rules violation — `useMemo` was declared AFTER an early `if (isLoading) return (...)` block. On loading renders the hook was never reached, violating the Rules of Hooks (hooks must be called in the same order on every render). ESLint reported this as an error.
- **Fix:** Moved `useMemo` above the `isLoading` early return so it always executes.
- **Status:** ✅ Fixed

### C2 — Debug log leaking partial service key in `api/square/callback.ts`

- **File:** `api/square/callback.ts` lines 23–30
- **Issue:** A debug block logged `keyPrefix: serviceKey.substring(0, 20)` and `isServiceRole: serviceKey.includes('service_role')` to Vercel function logs. This exposes the first 20 characters of the `SUPABASE_SERVICE_ROLE_KEY` — a partial secret — in production logs.
- **Fix:** Removed the entire debug block (7 lines) and the unused `serviceKey` variable.
- **Status:** ✅ Fixed

### C3 — `createOpenShift` in dataStore uses non-UUID shift ID

- **File:** `src/lib/store/dataStore.ts` line 2754 (prior session)
- **Issue:** Used `id: \`shift-open-${Date.now()}\``— not a valid UUID. Would cause a Postgres`invalid input syntax for type uuid` error when persisted.
- **Fix:** Changed to `crypto.randomUUID()`.
- **Status:** ✅ Fixed (applied in prior session)

---

## HIGH

### H1 — `ShiftSwapDialog` uses fake Zustand ID instead of DB-assigned UUID

- **File:** `src/components/ShiftSwapDialog.tsx` line 66
- **Issue:** After inserting to Supabase (which returns the DB UUID in `data.id`), the code called `createSwapRequest(shift.id, ...)` which creates a Zustand record with `id: swap-${Date.now()}` — a fake ID that does not match the DB. The `SwapRequestsPanel` would then use this fake ID for approve/reject Supabase operations (`.eq('id', fakeId)`), matching 0 rows silently — leaving the DB record in `pending` state while Zustand shows it approved/rejected.
- **Fix:** Replaced `createSwapRequest` call with `setShiftSwapRequests([...shiftSwapRequests, { id: data.id, ... }])` using the DB UUID and enriching with denormalized staff name from the local shift object.
- **Status:** ✅ Fixed

---

## MEDIUM

### M1 — Dead components (not imported anywhere)

- **Files:**
  - `src/components/AvailabilityDialog.tsx`
  - `src/components/ImportWizard.tsx`
  - `src/components/DateRangeSelector.tsx`
- **Issue:** These components exist but are not imported in any page. `AvailabilityDialog` is intentionally disconnected pending `staff_availability` schema migration. `ImportWizard` and `DateRangeSelector` are planned features.
- **Action:** Do NOT delete — prerequisites not met. Connect once schema is ready.
- **Status:** ⚠️ Documented — blocking conditions tracked in project memory

### M2 — Dead Zustand store actions (Zustand-only, not connected to UI)

- **File:** `src/lib/store/dataStore.ts`
- **Actions:**
  - `copyPreviousWeekRoster` (line 413) — copies shifts in memory only; `copyWeekShifts` in `useRosterStore.ts` is the proper DB-first replacement
  - `claimOpenShift` (line 2732) — updates shift in memory only; no DB write
  - `deleteLaborBudget` (line 2710) — deletes budget in memory only (`deleteLaborBudgetFromDB` exists in labourService.ts but not wired)
  - `addStaffAvailability` (line 2572) — Zustand-only; blocked on schema
  - `updateStaffAvailability` (line 2578) — Zustand-only; blocked on schema
  - `deleteStaffAvailability` (line 2586) — Zustand-only; blocked on schema
- **Issue:** Violates ADR-002 but not reachable from any UI. No active data loss.
- **Status:** ⚠️ Documented — fix when features are activated or schema migrated

### M3 — `createSwapRequest` / `approveSwapRequest` in dataStore (legacy Zustand-only stubs)

- **File:** `src/lib/store/dataStore.ts` lines 2618, 2643
- **Issue:** These stubs exist in the old dataStore. The actual UI now goes through DB-first paths in `ShiftSwapDialog` (fixed in H1 above). These stubs are vestigial.
- **Status:** ⚠️ Documented — safe to remove in future cleanup

---

## LOW

### L1 — Console statements in catch blocks lack context

- **Files:** Various pages and services
- **Issue:** Several `console.error(error)` calls in catch blocks without a contextual prefix message. Acceptable given Sentry integration and user-facing toast notifications.
- **Status:** ⚠️ Acceptable, low priority

### L2 — `BulkStaffImport` has no loading/error state

- **File:** `src/components/BulkStaffImport.tsx`
- **Issue:** Imports are fire-and-forget with no loading indicator visible after paste.
- **Status:** ⚠️ UX improvement, out of scope

### L3 — `copyPreviousWeekRoster` date comparison uses `>=` on Date objects

- **File:** `src/lib/store/dataStore.ts` line 422
- **Issue:** Works correctly in JS (numeric comparison), but `date-fns isWithinInterval` would be clearer.
- **Status:** ⚠️ No bug, cosmetic only

### L4 — `.catch(console.error)` in VenueSettings loses context

- **File:** `src/pages/admin/VenueSettings.tsx` line 84
- **Issue:** `console.error` passed directly as catch callback gives no component context in logs.
- **Status:** ⚠️ Acceptable, cosmetic
