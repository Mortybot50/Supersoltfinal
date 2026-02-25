# SuperSolt Platform — Code Audit

**Date:** 2026-02-24  
**Auditor:** MortyBot (automated full-codebase audit)  
**Scope:** Entire codebase — schema, auth, API, state, services, hooks, pages, types, performance

---

## Executive Summary

SuperSolt is a **functional MVP with real business logic** — not a throwaway prototype. The POS integration (Square), recipe costing engine, cost cascade, inventory depletion, and roster compliance checks are genuinely well-built. However, there are **critical security gaps** that must be fixed before any production use, and several architectural patterns that will cause pain at scale.

**Top 3 blockers for production:**
1. **Auth guard is disabled** — anyone can access any page without logging in
2. **Hardcoded `venue-1` fallbacks** everywhere — multi-venue is broken in practice
3. **2,600-line monolithic Zustand store** — unmaintainable, race-condition-prone

**Overall assessment:** 70% of the way to a shippable MVP. The database schema and API layer are solid. The frontend needs auth re-enabled and the venue-1 hardcodes eliminated.

---

## 1. Database & Schema

### 1.1 Migration Ordering Conflict
- **Severity:** Medium
- **Files:** `supabase/migrations/20250203000000_mvp_schema.sql` and `20250203000002_mvp_schema_fixed.sql`
- **Issue:** Two competing schema migrations — the original and a "fixed" version. Both use `CREATE TABLE IF NOT EXISTS` so they dont conflict at runtime, but its confusing. The first migration creates tables, the second re-creates the same tables with slightly different column lists. Future maintainers wont know which is canonical.
- **Fix:** Squash into a single baseline migration.

### 1.2 `USING (true)` RLS Policies Still Present in Migration History
- **Severity:** Low (mitigated)
- **Files:** Multiple early migrations (`20251027*`, `20251028*`, `20251029*`, `20251030*`)
- **Issue:** ~20 tables had `USING (true)` placeholder RLS policies. Migration `20260210000000_fix_rls_policies.sql` drops and replaces them with proper org-scoped policies. **This is correctly fixed** — but only if that migration has actually been applied to the production database. Verify this.
- **Fix:** Confirm `20260210000000` has run on production. Consider squashing migrations.

### 1.3 Mixed `org_id` Column Types (UUID vs TEXT)
- **Severity:** High
- **Files:** Various migrations
- **Issue:** Core MVP tables (`organizations`, `venues`, `org_members`) use `UUID` for IDs. But later Lovable-generated tables (`suppliers`, `stock_counts`, `waste_logs`, `venue_settings`, `members`, `inv_locations`) use `TEXT` for `org_id` and `venue_id`. This means:
  - No FK constraint enforcement between Lovable tables and core tables
  - RLS policies that join on `org_id` between UUID and TEXT columns silently fail or require casting
  - The `20260210000000` fix migration creates RLS policies for these tables that may not work correctly because the `org_id` TEXT values wont match UUID values from `get_user_org_ids()`
- **Fix:** Migrate all `org_id TEXT` / `venue_id TEXT` columns to `UUID` with proper FK constraints. This is the single most important schema fix.

### 1.4 Missing Indexes
- **Severity:** Medium
- **Issue:** Several tables lack indexes on commonly-queried columns:
  - `timesheets` — no index on `staff_id`, `venue_id`, or `status`
  - `roster_shifts` — no index on `staff_id` or `date`
  - `recipe_ingredients` — no index on `ingredient_id`
  - `purchase_order_items` — no index on `ingredient_id`
- **Fix:** Add composite indexes for the most common query patterns.

### 1.5 `orders` Table Has Duplicate Definitions
- **Severity:** Medium
- **Files:** `20250203000000` creates `orders` with `venue_id UUID`, then `20251027015708` creates `orders` with `venue_id TEXT`. Because of `IF NOT EXISTS`, only the first one wins — but the Lovable migration expects TEXT, and other Lovable tables reference venue_id as TEXT.
- **Fix:** Audit which definition is actually live in the database and ensure consistency.

---

## 2. Auth & Security

### 2.1 Auth Guard Disabled (CRITICAL)
- **Severity:** CRITICAL
- **File:** `src/components/ProtectedRoute.tsx`
- **Issue:** The auth check is commented out with `// TODO: Re-enable auth guard before production`. Every route is accessible to unauthenticated users.
- **Fix:** Uncomment the auth guard. This is a one-line fix.

### 2.2 No Role-Based Access Control on Frontend Routes
- **Severity:** Medium
- **File:** `src/components/ProtectedRoute.tsx`
- **Issue:** Even when auth is re-enabled, theres no role check. Any authenticated user can access admin pages like OrgSettings, AccessRoles, Integrations. The DB has RLS for write protection, but the UI exposes everything.
- **Fix:** Add a `requiredRole` prop to `ProtectedRoute` and check against `orgMember.role`.

### 2.3 Square OAuth State Parameter Not Signed
- **Severity:** Medium
- **File:** `api/square/auth.ts`
- **Issue:** The `state` parameter is a base64-encoded JSON object `{ org_id, venue_id }`. Its not signed or HMACd. An attacker could craft a state parameter pointing to a different org_id, and the callback would associate the Square connection with that org.
- **Fix:** HMAC-sign the state with a server secret and verify on callback.

### 2.4 Callback Endpoint Has No Auth Check
- **Severity:** Medium
- **File:** `api/square/callback.ts`
- **Issue:** The callback handler validates org/venue existence in DB but doesnt verify the user who initiated the flow is authenticated or authorized.
- **Fix:** Include a user token or session ID in the state parameter and verify it on callback.

### 2.5 Webhook Signature Verification Raw Body Issue
- **Severity:** Medium
- **File:** `api/square/webhook.ts`
- **Issue:** Vercel may parse the body as JSON before the handler runs, meaning `JSON.stringify(req.body)` wont match the original raw body that Square signed. This could cause all webhook signature checks to fail silently.
- **Fix:** Configure Vercel to pass raw body, or use `req.rawBody` if available.

---

## 3. API / Serverless Functions

### 3.1 Overall Assessment
The Square API layer (`api/square/`) is **well-built**:
- Auth checks on sync and auth endpoints
- Token encryption at rest (AES-256-GCM)
- Automatic token refresh on 401
- Pagination handling
- Idempotent upserts with dedup
- Batch processing (200-row batches)

### 3.2 Sync Has No Rate Limiting
- **Severity:** Medium
- **File:** `api/square/sync.ts`
- **Issue:** Any authenticated user can spam the sync endpoint. Square has API rate limits — hitting them would break sync for the entire org.
- **Fix:** Add a cooldown check (dont allow sync if last_sync_at < 5 minutes ago).

### 3.3 Sync Error Recovery Is Incomplete
- **Severity:** Low
- **File:** `api/square/sync.ts`
- **Issue:** If a batch upsert fails mid-sync, `skipped` is incremented but the sync still reports `success`.
- **Fix:** Return `partial` status when `skipped > 0`.

---

## 4. State Management

### 4.1 Monolithic 2,600-Line Zustand Store
- **Severity:** High
- **File:** `src/lib/store/dataStore.ts`
- **Issue:** Single store contains ALL app state and CRUD operations. Every state update triggers re-renders in every connected component. Extremely difficult to reason about state dependencies. Race conditions when multiple async operations update the store simultaneously.
- **Fix:** Split into domain-specific stores: `useOrgStore`, `useInventoryStore`, `useLabourStore`, `useMenuStore`, etc.

### 4.2 `as any` Type Casting in Store
- **Severity:** Medium
- **File:** `src/lib/store/dataStore.ts`, lines 971-985
- **Issue:** Menu item mapping uses `(item as any)` extensively (~15 times in one block).
- **Fix:** Define proper DB-to-App type mappings.

### 4.3 LocalStorage Persistence of Entire Store
- **Severity:** Medium
- **File:** `src/lib/store/dataStore.ts`
- **Issue:** The entire store is persisted to localStorage. For a busy venue this will exceed localStorages ~5MB limit.
- **Fix:** Only persist user preferences and UI state. Use React Query for server data caching.

### 4.4 Dual Data Loading Pattern
- **Severity:** Medium
- **Issue:** Some data loads via Zustand store methods, while some loads via React Query hooks. These can get out of sync.
- **Fix:** Pick one pattern. React Query for server state, Zustand for client-only state.

---

## 5. Service Layer

### 5.1 Overall Assessment
The service layer is **solid**: proper DB-to-App type mapping, error handling, Zod validation. Well-designed cost cascade and inventory depletion engines.

### 5.2 Hardcoded `venue-1` in Labour Service
- **Severity:** High
- **File:** `src/lib/services/labourService.ts`, lines 67, 691
- **Issue:** Staff loading defaults `venue_id` to `'venue-1'`. Multi-venue filtering will never work correctly.
- **Fix:** Pass venue_id from the join/query result, not a hardcoded default.

### 5.3 Cost Cascade Does Not Persist to DB
- **Severity:** Medium
- **File:** `src/lib/services/costCascade.ts`
- **Issue:** `runCostCascade()` and `applyCascadeToState()` only update in-memory Zustand state. Recalculated recipe costs and menu item GP% are NOT written back to Supabase.
- **Fix:** Add a `persistCascadeResults()` function that batch-updates affected recipes and menu items in Supabase.

### 5.4 Recipe Ingredient Delete-and-Reinsert Pattern
- **Severity:** Low
- **File:** `src/lib/services/recipeService.ts`
- **Issue:** On recipe update, all recipe_ingredients are deleted then re-inserted. Not wrapped in a transaction — a failure mid-insert leaves the recipe with missing ingredients.
- **Fix:** Use upsert with delete of orphans, ideally in an RPC/transaction.

---

## 6. React Query Hooks

### 6.1 Overall Assessment
The hooks are **well-implemented** with correct business calculations.

### 6.2 No Pagination on Orders Query
- **Severity:** Medium
- **File:** `src/lib/hooks/useSalesMetrics.ts`
- **Issue:** Fetches ALL orders with no limit. A busy venue could have 10,000+ orders/month, hitting Supabases default 1,000-row limit.
- **Fix:** Add pagination or use a DB aggregate view.

### 6.3 COGS Theoretical vs Actual Are Identical
- **Severity:** Low
- **File:** `src/lib/hooks/useCOGSMetrics.ts`
- **Issue:** `theoreticalCOGS = actualCOGS` — the variance is always 0%. The comparison is meaningless.
- **Fix:** Calculate theoretical COGS from recipe-based depletion (the engine exists but isnt wired up).

### 6.4 Duplicate Orders Queries Across Hooks
- **Severity:** Low
- **Files:** `useSalesMetrics.ts`, `useLabourMetrics.ts`, `useCOGSMetrics.ts`
- **Issue:** Each hook independently fetches orders for the same venue/date range on Dashboard load.
- **Fix:** Align React Query cache keys or share via parent query.

---

## 7. Pages & Components

### Summary Table

| Page | Status | Reads DB? | Writes DB? | Key Issues |
|------|--------|-----------|------------|------------|
| Dashboard | Working | React Query | No | Complex, well-built |
| Sales | Working | Direct query | No | No pagination |
| Ingredients | Working | Zustand | Yes | Good cost cascade |
| MenuItems | Working | Zustand | Yes | Heavy `as any` casting |
| People | Working | Zustand | Yes | Functional |
| Payroll | Working | Zustand | No | Export is UI only |
| Suppliers | Working | Zustand | Yes | Good ABN validation |
| Roster | Working | Zustand | Yes | venue-1 hardcode |
| Timesheets | Working | Zustand | Yes | Functional |
| RecipeEditor | Working | Zustand | Yes (service) | Well-built |
| PurchaseOrders | Working | Zustand | Yes | Functional |
| StockCounts | Working | Zustand | Yes | Functional |
| Waste | Working | Zustand | Yes | Functional |
| Compliance | UI Shell | No | No | Static, no persistence |
| Integrations | Working | Supabase + API | Yes | Square OAuth works |
| OrgSettings | Working | Zustand | Yes | Large form, functional |
| VenueSettings | Working | Supabase | Yes | Direct calls |
| AccessRoles | Partial | Partial | Partial | May not match schema |
| Onboarding | Working | Zustand | Yes | Multi-step flow |
| Auth (Login/Signup) | Working | Supabase Auth | Yes | Standard flow |

### 7.1 Hardcoded `venue-1` Throughout Pages
- **Severity:** High
- **Files:** StaffDialog, ShiftDialog, AvailabilityDialog, Ingredients, Roster, SupplierDetail, rosterCalculations
- **Issue:** At least 10 locations use `venue_id: 'venue-1'` as a fallback. Multi-venue is effectively broken.
- **Fix:** Always derive venue_id from `useAuth().currentVenue.id`.

### 7.2 Compliance Page Is a Static Shell
- **Severity:** Low
- **File:** `src/pages/operations/Compliance.tsx`
- **Issue:** Static checklist with no DB backing.
- **Fix:** Add persistence to venue_settings or a dedicated table.

### 7.3 Payroll Export Is UI Only
- **Severity:** Medium
- **File:** `src/pages/Payroll.tsx`
- **Issue:** Export format selector exists but actual integration with Xero/KeyPay is not implemented.
- **Fix:** Acceptable for MVP if CSV format matches import specs.

---

## 8. Business Logic

All core calculations are **correct for Australian hospitality**:
- GP% = (price_ex_gst - cost) / price_ex_gst x 100
- Suggested price = cost / (1 - gp_target%)
- Labour% = total_pay / net_sales x 100
- GST handling: consistent INC/EXC mode, default 10%
- All monetary values in cents (integer)
- Fair Work: overtime detection, 10h rest gap, 30min break if >5h shift

---

## 9. Types

### 9.1 `any` Type Usage (~20 occurrences)
- **Severity:** Medium
- **Worst offender:** `dataStore.ts` lines 971-985 (15x `as any` for menu items)
- **Fix:** Define proper intermediate types.

### 9.2 UUID vs TEXT Type Mismatch
- **Severity:** High
- **Issue:** Core tables use UUID, Lovable tables use TEXT. Joins across these silently return no results.
- **Fix:** Align all ID columns to UUID.

---

## 10. Performance

### 10.1 No Pagination Anywhere
- **Severity:** Medium
- **Fix:** Add pagination to list views, aggregates for metrics.

### 10.2 Full Store Re-render on Any Change
- **Severity:** Medium
- **Fix:** Use Zustand selectors or split stores.

### 10.3 Triple Orders Fetch on Dashboard
- **Severity:** Low
- **Fix:** Align React Query cache keys.

---

## Prioritized Action List

### CRITICAL (Fix Before Any Production Use)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Re-enable auth guard in ProtectedRoute.tsx | 5 min | Security |
| 2 | Fix UUID vs TEXT mismatch on org_id/venue_id columns | 2-4h | Data integrity, RLS |
| 3 | Verify RLS fix migration (20260210000000) applied to prod | 10 min | Security |
| 4 | Eliminate all venue-1 hardcodes | 1-2h | Multi-venue |

### HIGH (Fix Before Beta Users)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 5 | Split monolithic Zustand store into domain stores | 1-2 days | Maintainability |
| 6 | Persist cost cascade results to Supabase | 2-3h | Data durability |
| 7 | Add role-based route protection | 2-3h | Security |
| 8 | HMAC-sign Square OAuth state parameter | 1h | Security |
| 9 | Add missing DB indexes | 30 min | Performance |
| 10 | Add pagination to queries | 3-4h | Performance |

### MEDIUM (Fix Before Scale)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 11 | Wire up theoretical COGS from depletion engine | 3-4h | Business accuracy |
| 12 | Remove all `as any` type casts | 1-2h | Type safety |
| 13 | Add sync rate limiting | 1h | Reliability |
| 14 | Deduplicate orders queries across hooks | 1h | Performance |
| 15 | Squash migration history | 1h | Maintainability |

### LOW (Nice to Have)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 16 | Transaction-wrap recipe ingredient updates | 1h | Data integrity |
| 17 | Fix Vercel raw body for webhook signature | 1h | Webhook reliability |
| 18 | Add search input debouncing | 30 min | UX |
| 19 | Remove localStorage persistence for server data | 1h | Reliability |
| 20 | Persist compliance checklists | 2h | Feature completeness |
