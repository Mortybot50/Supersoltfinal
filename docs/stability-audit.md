# Stability Audit — 2026-03-05

## Build Status

| Check                    | Result                                                 |
| ------------------------ | ------------------------------------------------------ |
| TSC (`npx tsc --noEmit`) | ✅ PASS — 0 errors                                     |
| Build (`npm run build`)  | ✅ PASS — 3.14s (chunk size warning, non-blocking)     |
| Lint (`npm run lint`)    | ✅ 0 errors, 42 warnings (was: 30 errors, 42 warnings) |

## Route Health (Code Analysis)

> Browser runtime testing unavailable — analysis performed via code inspection for null-safety, import integrity, and crash vectors.

| Route                        | Status  | Notes                                                             |
| ---------------------------- | ------- | ----------------------------------------------------------------- |
| `/` (dashboard)              | ✅ PASS | Guards on `currentOrg`/`currentVenue`, proper optional chaining   |
| `/workforce/people`          | ✅ PASS | `currentOrg?.id` guards, EmptyState imported                      |
| `/workforce/roster`          | ✅ PASS | Infinite loop fix in place (`selectedDateTs` dep), guards on init |
| `/workforce/timesheets`      | ✅ PASS | Standard page structure                                           |
| `/inventory/order-guide`     | ✅ PASS | Standard page structure                                           |
| `/inventory/purchase-orders` | ✅ PASS | Standard page structure                                           |
| `/inventory/stock-counts`    | ✅ PASS | Standard page structure                                           |
| `/inventory/waste`           | ✅ PASS | Standard page structure                                           |
| `/menu/items`                | ✅ PASS | Standard page structure                                           |
| `/menu/recipes`              | ✅ PASS | Standard page structure                                           |
| `/operations/daybook`        | ✅ PASS | Standard page structure                                           |
| `/admin/org-settings`        | ✅ PASS | `currentOrg?.id` guard in useEffect                               |
| `/admin/venue-settings`      | ✅ PASS | Guard on `currentVenue`                                           |
| `/admin/locations`           | ✅ PASS | EmptyState imported correctly                                     |
| `/admin/integrations`        | ✅ PASS | Guards on org/venue context                                       |
| `/setup`                     | ✅ PASS | Steps 2-5 guarded with `currentOrg &&`                            |
| `/onboarding/*`              | ✅ PASS | URL-token-based, no org context needed                            |

## Known Bugs — Status

| Bug                                   | File                                                    | Status                                                               |
| ------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Infinite loop in `loadWeek` useEffect | `src/pages/labour/Roster.tsx`                           | ✅ FIXED — uses `selectedDateTs` (timestamp) as dep, not Date object |
| Missing EmptyState import             | `src/pages/People.tsx`, `src/pages/admin/Locations.tsx` | ✅ FIXED — both import from `@/components/shared`                    |
| Duplicate `useAuth` import            | Various                                                 | ✅ FIXED — no duplicate imports from same module remain              |
| Broken debug statement (parse error)  | `api/square/callback.ts`                                | ✅ FIXED — missing `console.log(` call restored                      |
| Empty else blocks                     | `src/lib/store/dataStore.ts`                            | ✅ FIXED — removed empty else clauses                                |

## Fixes Applied (this audit)

| #   | Fix                                                                                                                                     | Severity    | File(s)                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------- |
| 1   | Broken `console.log` in Square callback — dangling object literal caused ESLint parse error and **would crash the serverless function** | 🔴 Critical | `api/square/callback.ts`                                                          |
| 2   | Consolidated duplicate imports across 5 files                                                                                           | 🟡 Low      | RosterGrid, People, InviteStep, SuperChoiceStep, TFNDeclarationStep, ImportWizard |
| 3   | `let` → `const` for never-reassigned vars                                                                                               | 🟢 Style    | RosterMonthView, rosterCalculations                                               |
| 4   | Removed useless escape chars in regex                                                                                                   | 🟢 Style    | onboarding.ts, validation.ts                                                      |
| 5   | Removed empty else blocks                                                                                                               | 🟢 Style    | dataStore.ts                                                                      |
| 6   | Replaced `catch (err: any)` with `catch (err: unknown)` across all API routes                                                           | 🟡 Medium   | All `api/square/*.ts` files                                                       |
| 7   | Empty block in callback.ts (else after location mapping)                                                                                | 🟢 Style    | callback.ts                                                                       |
| 8   | Proper types for Dashboard tooltip (was `any`)                                                                                          | 🟡 Medium   | Dashboard.tsx                                                                     |
| 9   | `RosterWarning` type for ComplianceSummary (was `any`)                                                                                  | 🟡 Medium   | ComplianceSummary.tsx                                                             |
| 10  | Targeted eslint-disable for unavoidable Supabase `any` casts                                                                            | 🟢 Style    | useRosterStore.ts                                                                 |

## Remaining Warnings (42, all non-blocking)

- **`react-hooks/exhaustive-deps`** (28): Missing deps in useEffect/useMemo — intentional in most cases (DB loaders in deps would cause infinite fetches)
- **`react-refresh/only-export-components`** (12): Files export both components and constants — doesn't affect functionality
- **`prefer-const` in useMemo dep warnings** (2): Non-breaking

## Technical Debt (pre-existing, not addressed)

- People.tsx staff creation is Zustand-only (not writing to Supabase staff table)
- Onboarding step progress not persisted to DB
- Fake staff IDs (`staff-${timestamp}`) break FK relationships
- `staff_invites` table has `staff_id NOT NULL` — wrong for pre-acceptance invites
- 1 TODO in codebase (Sentry in ErrorBoundary — low priority)
- Bundle size: 2,365 kB main chunk — needs code splitting
- `npm audit`: 12 vulnerabilities (5 moderate, 7 high) — dependency updates needed
