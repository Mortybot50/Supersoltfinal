# SuperSolt Production-Readiness Audit v2
**Date:** 2026-02-25  
**Auditor:** MortyBot  
**Codebase:** 181 files, 47,829 LOC (excl. auto-generated types)  
**Build:** ✅ Clean (zero TS errors, zero lint errors)

---

## 1. CODE QUALITY

| # | Issue | Severity | File(s) | Suggested Fix | Effort |
|---|-------|----------|---------|---------------|--------|
| 1.1 | **Monolith dataStore.ts — 2,600 lines** | High | `lib/store/dataStore.ts` | Split into domain slices: `supplierSlice`, `inventorySlice`, `labourSlice`, `recipeSlice`, `orderSlice` | 1-2 days |
| 1.2 | **118 console.log/warn/error statements** | Medium | dataStore (43), labourService (26), Locations (15) | Replace with proper logging utility or remove; keep only intentional error logging | 2-3h |
| 1.3 | **Zero error boundaries** | High | App-wide | Add `<ErrorBoundary>` at route level in App.tsx and around each major page section. React crashes currently show white screen. | 3-4h |
| 1.4 | **38 components over 300 lines** (17 pages >500 lines) | Medium | Locations (1372), DataImports (1283), OrgSettings (1273), MenuItems (1129), Dashboard (1045) | Extract sub-components: forms, tables, dialogs into separate files | 2-3 days |
| 1.5 | **Zero React.memo usage** | Medium | All list components | Add `React.memo` to `ShiftCard`, `StaffRow`, `IngredientRow`, `OrderRow` | 2-3h |
| 1.6 | **`any` types in Dashboard tooltip** | Low | `pages/Dashboard.tsx:174,179` | Type the Recharts tooltip props properly | 15 min |
| 1.7 | **Dead exported functions** | Low | `lib/currency.ts`, `lib/config/importMappings.ts`, `lib/constants/onboarding.ts`, `lib/utils/validation.ts` | Remove or mark as planned-for-use | 30 min |
| 1.8 | **Dynamic import of Supabase client in dataStore** (34 `import()` calls) | Medium | `lib/store/dataStore.ts` | Use static import; dynamic import prevents tree-shaking and causes Vite warnings | 1h |
| 1.9 | **types/index.ts is 1,488 lines** | Low | `types/index.ts` | Split into domain type files: `types/labour.ts`, `types/inventory.ts`, etc. | 1-2h |

## 2. DATABASE

| # | Issue | Severity | Table(s) | Suggested Fix | Effort |
|---|-------|----------|----------|---------------|--------|
| 2.1 | **ingredient_price_history has USING(true) RLS** — any authenticated user can read/write all orgs' price history | Critical | `ingredient_price_history` | Add org-scoped RLS via join to `ingredients.org_id` | 30 min |
| 2.2 | **org_members: SELECT-only policy** — no INSERT/UPDATE/DELETE policies. New org creation or member management must use service_role or will silently fail. | High | `org_members` | Add INSERT policy for org owners, UPDATE policy for admins | 1h |
| 2.3 | **organizations: SELECT-only policy** — can't create new orgs via client | High | `organizations` | Add INSERT policy for authenticated users (for signup flow) | 30 min |
| 2.4 | **venues: SELECT-only policy** — can't create venues via client | High | `venues` | Add INSERT/UPDATE policy for org owners/admins | 30 min |
| 2.5 | **admin_data_audit/jobs: authenticated USING(true)** — any authenticated user can see all admin audit logs | Medium | `admin_data_audit`, `admin_data_jobs` | Restrict to org admins or add org_id scoping | 30 min |
| 2.6 | **No database backups configured** | High | All | Enable Supabase point-in-time recovery (PITR) on Pro plan, or set up pg_dump cron | 1h |
| 2.7 | **waste_logs.org_id is nullable** (new column from migration) | Medium | `waste_logs` + 9 other tables | Add NOT NULL constraint after backfill, or add trigger to auto-populate from venue | 1h |

## 3. AUTH & SECURITY

| # | Issue | Severity | File(s) | Suggested Fix | Effort |
|---|-------|----------|---------|---------------|--------|
| 3.1 | **Square OAuth state param not HMAC-signed** — base64-encoded JSON with org_id/venue_id is spoofable | Critical | `api/square/auth.ts:41` | HMAC-sign the state with a server secret; verify in callback | 1h |
| 3.2 | **No CORS config on Vercel API routes** | Medium | `api/square/*.ts` | Add explicit CORS headers or Vercel middleware; currently inherits Vercel defaults (permissive) | 30 min |
| 3.3 | **No rate limiting on API routes** | High | `api/square/*.ts` | Add Vercel Edge middleware or Upstash ratelimit for auth/callback/sync endpoints | 2h |
| 3.4 | **Most routes have no `requiredRole` guard** — 20+ routes accessible to any authenticated user including `staff` role | Medium | `App.tsx` | Add `requiredRole="manager"` to admin-adjacent routes (Locations, VenueSettings, DataImports) | 30 min |
| 3.5 | **No session timeout/refresh logic** | Medium | `AuthContext.tsx` | Supabase handles JWT refresh, but no explicit timeout UI or "session expired" handling | 1h |
| 3.6 | **Webhook secret in env, not validated for existence** | Low | `api/square/webhook.ts` | Already validates; good. But `env()` throws on missing — add graceful degradation | 15 min |

## 4. API & DATA FLOW

| # | Issue | Severity | File(s) | Suggested Fix | Effort |
|---|-------|----------|---------|---------------|--------|
| 4.1 | **154 Supabase queries — many without proper error handling** | High | dataStore.ts, various pages | Audit each `.from()` call; ensure `if (error) throw error` or toast notification | 4-6h |
| 4.2 | **dataStore loads ALL data on init** — no pagination | High | `DataInitializer.tsx`, `dataStore.ts` | Add cursor/offset pagination for ingredients, orders, staff; lazy-load per-page | 1-2 days |
| 4.3 | **N+1 query pattern in recipe loading** — loads recipes, then ingredients separately, then joins client-side | Medium | `recipeService.ts:80-105` | Use Supabase nested select: `.select('*, recipe_ingredients(*, ingredients(*)')` | 2h |
| 4.4 | **Cost cascade not persisted to DB** | Medium | `costCascade.ts` | Results calculated client-side only; menu item food_cost_pct not saved back | 2-3h |
| 4.5 | **Race condition: multiple tabs writing to same Zustand store via localStorage** | Medium | `dataStore.ts` | Add tab-sync middleware or remove localStorage persistence for server-state data | 2h |
| 4.6 | **43 empty state handlers vs 30+ pages** — many pages don't handle empty data gracefully | Medium | Various pages | Add `<EmptyState>` component for all list/table views | 2-3h |

## 5. UX & NAVIGATION

| # | Issue | Severity | File(s) | Suggested Fix | Effort |
|---|-------|----------|---------|---------------|--------|
| 5.1 | **23 forms without Zod validation** — including auth forms, onboarding steps (TFN, bank details, super choice) | High | Login, Signup, all onboarding steps, Suppliers, MenuItems, Ingredients, Roster, etc. | Add zodResolver to all forms with sensitive data | 1-2 days |
| 5.2 | **No breadcrumbs on detail pages** | Low | SupplierDetail, PurchaseOrderDetail, RecipeEditor, StaffDetail | Add breadcrumb component to detail/edit pages | 2h |
| 5.3 | **No 404 handling for invalid detail IDs** — `/suppliers/invalid-uuid` will crash or show blank | Medium | Detail pages | Add ID validation and "not found" state | 1h |
| 5.4 | **Onboarding portal has no auth** — token-only access, but tokens don't appear to expire in practice | Medium | `InvitePortal.tsx` | Enforce `isTokenExpired()` check; add token rotation after use | 1h |
| 5.5 | **No mobile responsiveness testing evidence** | Medium | All pages | Many pages use fixed-width tables; need responsive tables or mobile card layouts | 2-3 days |
| 5.6 | **White screen on crash (no error boundaries)** | High | App-wide | Same as 1.3 | See 1.3 |

## 6. MULTI-TENANCY

| # | Issue | Severity | File(s) | Suggested Fix | Effort |
|---|-------|----------|---------|---------------|--------|
| 6.1 | **8 remaining hardcoded fallbacks: `VENUE-001` (3), `ORG-001` (5)** | Critical | `dataStore.ts:1003,1770,1994,2012,2030,2048,2091,2202`, `NewStockCount.tsx:177`, `Waste.tsx:210` | Replace all with `currentOrg.id`/`currentVenue.id` from auth context; fail loudly if missing | 2h |
| 6.2 | **Zustand store queries don't filter by org** — `loadSuppliersFromDB`, `loadIngredientsFromDB` etc. load ALL data (relies on RLS only) | Medium | `dataStore.ts` | Add `.eq('org_id', orgId)` as defense-in-depth alongside RLS | 2h |
| 6.3 | **ingredient_price_history cross-org leak** | Critical | DB | Same as 2.1 | See 2.1 |
| 6.4 | **supplier table uses `organization_id` while all other tables use `org_id`** | Low | `suppliers` table | Cosmetic inconsistency; works but confusing for developers | 1h (migration) |

## 7. AU COMPLIANCE

| # | Issue | Severity | File(s) | Suggested Fix | Effort |
|---|-------|----------|---------|---------------|--------|
| 7.1 | **Penalty rates are constants, not award-engine** — doesn't handle award variations (Restaurant Industry Award vs Fast Food Award vs General Retail) | High | `types/index.ts`, `rosterCalculations.ts` | Current implementation is HIGA-specific. Flag as known limitation; proper rules engine is $15-20K specialist work | Specialist |
| 7.2 | **No TFN validation algorithm** — TFN field exists in onboarding but no check digit validation | Medium | `onboarding/steps/TFNDeclarationStep.tsx` | Implement ATO TFN check digit algorithm (weights: 1,4,3,7,5,8,6,9,10) | 1h |
| 7.3 | **Super guarantee rate not configurable** — hardcoded or missing entirely | Medium | Types only | Add super rate to venue_settings (currently 11.5%, rising to 12% July 2025) | 1h |
| 7.4 | **Break rules only warn, don't enforce** — scheduler allows publishing shifts that violate Fair Work break requirements | Medium | `rosterCalculations.ts:62-67` | Add "block publish if critical violations" option in venue settings | 2h |
| 7.5 | **GST handling present but no BAS report** | Medium | Various | GST inc/exc toggling works; no BAS summary report for quarterly lodgement | 2-3 days |
| 7.6 | **No VEVO integration** | Low | Not started | Planned as specialist work ($5-10K) | Specialist |
| 7.7 | **Overtime calculation doesn't track weekly hours across shifts** | High | `rosterCalculations.ts:82-87` | `weeklyHoursForStaff` param exists but caller passes 0 in many cases | 2h |

## 8. PERFORMANCE

| # | Issue | Severity | File(s) | Suggested Fix | Effort |
|---|-------|----------|---------|---------------|--------|
| 8.1 | **Single JS bundle: 2,321 KB (643 KB gzipped)** | High | Build output | Add `manualChunks` in vite.config: split vendor (radix, recharts, date-fns), pages (lazy routes) | 3-4h |
| 8.2 | **No route-level code splitting** | High | `App.tsx` | Use `React.lazy()` + `Suspense` for all page components | 2h |
| 8.3 | **Zero React.memo** on list items | Medium | All list components | See 1.5 | See 1.5 |
| 8.4 | **Zustand store subscriptions without selectors** (35 components subscribe to entire store) | Medium | Various | Use granular selectors: `useDataStore(s => s.suppliers)` not `useDataStore()` | 2-3h |
| 8.5 | **DataInitializer loads 15+ tables on every page load** | High | `DataInitializer.tsx` | Lazy-load data per route; only load what's needed | 1 day |
| 8.6 | **sonner (toast library) dynamically imported 7x in dataStore** | Low | `dataStore.ts` | Static import once | 15 min |

## 9. MISSING FEATURES vs MVP SPEC

| Module | Status | What's Built | What's Missing |
|--------|--------|-------------|----------------|
| **Core Platform** | 🟢 80% | Auth, org/venue structure, profiles, role system, layout, navigation | Org creation flow (can't create new orgs from UI), invite acceptance flow incomplete |
| **Sales Analytics** | 🟡 60% | Dashboard charts, date filtering, channel/payment breakdown, Square sync | Real-time updates (webhook → UI), export to CSV, comparison periods, targets |
| **Inventory** | 🟡 50% | Ingredients CRUD, supplier management, PO creation, stock counts, waste logs, order guide | Auto-reorder alerts, depletion tracking (module exists but not wired), par level notifications |
| **Menu & Recipes** | 🟢 70% | Recipe builder, ingredient costing, GP% calculation, food cost cascade | Menu engineering matrix, suggested pricing, seasonal menu planning |
| **Workforce** | 🟢 75% | Roster builder, shift templates, timesheets, payroll export, penalty rates, shift swaps, availability, onboarding portal | Award interpreter engine, leave management, qualification tracking, clock-in (geofence) |
| **Financial Ops** | 🟡 40% | Daybook entries, compliance checklist UI, invoice upload | Cash flow forecasting, budget vs actual, BAS report, P&L by venue |
| **POS Integration** | 🟢 85% | Square OAuth2, order sync, webhook receiver, encrypted tokens, location mapping | Real-time webhook processing (currently just logs), multi-POS support (Lightspeed etc.) |
| **Multi-venue** | 🟢 70% | RLS on all 44 tables, org/venue scoping, venue switcher | Venue comparison reports, consolidated multi-venue dashboards, data rollup views |

## 10. DEPLOYMENT READINESS

| # | Issue | Severity | Suggested Fix | Effort |
|---|-------|----------|---------------|--------|
| 10.1 | **Zero error monitoring (no Sentry/LogRocket)** | Critical | Add Sentry: `npm i @sentry/react`, init in main.tsx, add ErrorBoundary | 2h |
| 10.2 | **No CI/CD pipeline** — no GitHub Actions, no test runner | Critical | Add `.github/workflows/ci.yml`: lint, tsc, build on PR. Add Playwright for smoke tests. | 4-6h |
| 10.3 | **No tests whatsoever** — zero unit, integration, or e2e tests | Critical | Start with: auth flow e2e, penalty rate unit tests, RLS integration tests | 2-3 days |
| 10.4 | **No database backups** | High | See 2.6 | See 2.6 |
| 10.5 | **No environment validation** — app starts even if env vars are missing | Medium | Add Zod env validation in a `config.ts` that runs at startup | 1h |
| 10.6 | **No logging infrastructure** — console.log only | Medium | Add structured logging (pino or similar); ship to Vercel Logs or external | 2-3h |
| 10.7 | **vercel.json only has SPA rewrite** — no headers, no caching, no security headers | Medium | Add security headers (CSP, X-Frame-Options, etc.) | 1h |

---

## PRIORITIZED ACTION PLAN

### Phase 0: Stop the Bleeding (Before any users) — ~2 days
1. **Fix remaining VENUE-001/ORG-001 hardcodes** in dataStore (#6.1) — 2h
2. **Fix ingredient_price_history RLS** (#2.1) — 30 min
3. **HMAC-sign Square OAuth state** (#3.1) — 1h
4. **Add error boundaries** (#1.3) — 3h
5. **Add Sentry** (#10.1) — 2h
6. **Fix org_members/organizations/venues write policies** (#2.2, 2.3, 2.4) — 2h

### Phase 1: Launch Minimum (Beta users) — ~1 week
7. **Add Zod validation to auth + onboarding forms** (#5.1 partial) — 1 day
8. **Code-split routes with React.lazy** (#8.2) — 2h
9. **Add CI pipeline** (#10.2) — 4h
10. **Add rate limiting to API** (#3.3) — 2h
11. **Fix weekly overtime tracking** (#7.7) — 2h
12. **Add pagination to data loading** (#4.2) — 1 day
13. **Add env validation** (#10.5) — 1h

### Phase 2: Production Hardening — ~2 weeks
14. **Split dataStore.ts** (#1.1) — 2 days
15. **Add requiredRole to sensitive routes** (#3.4) — 30 min
16. **Remove console.logs, add structured logging** (#1.2, #10.6) — 1 day
17. **Add Zod to remaining forms** (#5.1) — 1 day
18. **Persist cost cascade to DB** (#4.4) — 3h
19. **N+1 query fixes** (#4.3) — 2h
20. **Mobile responsiveness pass** (#5.5) — 2-3 days
21. **Write smoke tests** (#10.3) — 2 days
22. **TFN validation** (#7.2) — 1h
23. **Bundle splitting** (#8.1) — 3h

### Phase 3: Scale & Compliance — ~1 month
24. **Fair Work award engine** (specialist) — $15-20K
25. **BAS reporting** (#7.5) — 3 days
26. **VEVO integration** (specialist) — $5-10K
27. **Xero/MYOB sync** (specialist) — $30-50K

---

**Bottom line:** The app has solid bones — good schema design, proper RLS (after today's fixes), encrypted POS tokens, working penalty rate calculations. The critical gaps are operational: no error monitoring, no tests, no CI/CD, and 8 remaining hardcoded fallbacks that would break multi-tenancy. Phase 0 (~2 days of work) gets you to "safe for beta testers." Phase 1 (~1 week) gets you to "safe for paying customers."
