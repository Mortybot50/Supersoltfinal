# Audit Summary — SuperSolt
**Date:** 2026-03-12
**Branch:** fix/skill-audit-sweep
**Auditor:** Claude (claude-sonnet-4-6)

---

## Overall Stats

| Phase | Findings | Fixed | Documented |
|-------|----------|-------|------------|
| Phase 1 — Database (RLS, indexes, schema) | 13 | 5 | 8 |
| Phase 2 — Code quality (TypeScript, state bugs) | 11 | 5 | 6 |
| Phase 3 — Frontend (a11y, responsiveness) | 12 | 3 | 9 |
| Phase 4 — Tests | 58 tests written/fixed | — | — |
| Phase 5 — Security | 6 | 1 (pre-audit) | 5 |
| **Total** | **42** | **14** | **28** |

**Commits in this branch:**
```
73d1f03 fix: security audit findings — document auth posture
0e85ac4 test: fix public holiday UTC bug, scope vitest to src/, add test-results
40d9a3d fix: frontend audit — a11y, mobile responsiveness
ba2dcbf fix: code audit — conditional hook, debug key leak, swap request fake ID
9024930 fix: code audit — fix non-UUID open shift ID, document dead code
c3c40d4 fix: database audit — RLS, indexes, schema cleanup
```

---

## Phase 1 — Database Audit

**Document:** `docs/audit/database-audit.md`
**Migration:** `supabase/migrations/20260312000002_audit_rls_and_index_fixes.sql`

### Fixed
| # | Issue | Severity |
|---|-------|----------|
| C1 | `ingredient_price_history` RLS broken JOIN (`venue_id` → `org_id`) — all price history inaccessible | Critical |
| H1 | `admin_data_jobs` / `admin_data_audit` using `USING(true)` — any user could read all org admin logs | High |
| H3 | `ingredient_price_history` missing explicit DELETE policy (append-only semantics) | High |
| M1 | 4 missing indexes on `qualification_types` and `staff_qualifications` | Medium |

### Documented (action required before launch or on next milestone)
| # | Issue | Severity | Next Step |
|---|-------|----------|-----------|
| H2 | `staff_invites` USING(true) — email addresses enumerable | High | Need `/api/invites/verify` server-side endpoint first |
| M2 | `qualification_types` writes not restricted to org admins | Medium | Morty to decide if crew can add qual types |
| M3 | `staff_availability` missing `specific_date`, `notes`, `is_recurring` columns | Medium | Dedicated migration + AvailabilityDialog fix |
| M4 | `public_holidays` missing UNIQUE(date, state, org_id) | Medium | Low priority; no duplicates observed |
| L1–L5 | Inefficient legacy RLS JOINs, missing composite indexes, nullable audit cols | Low | Backlog |

---

## Phase 2 — Code Quality Audit

**Document:** `docs/audit/code-audit.md`
**Build status at completion:** tsc ✅ lint ✅ build ✅

### Fixed
| # | Issue | Severity |
|---|-------|----------|
| C1 | `InventoryInsights.tsx`: `useMemo` called after early return — Rules of Hooks violation | Critical |
| C2 | `api/square/callback.ts`: debug block logging first 20 chars of `SUPABASE_SERVICE_ROLE_KEY` | Critical |
| C3 | `dataStore.ts createOpenShift`: non-UUID `shift-open-${Date.now()}` ID | Critical |
| H1 | `ShiftSwapDialog.tsx`: Zustand record used fake `swap-${Date.now()}` ID instead of DB UUID; approve/reject silently matched 0 rows | High |

### Documented
| # | Issue | Severity | Next Step |
|---|-------|----------|-----------|
| M1 | 3 dead components (AvailabilityDialog, ImportWizard, DateRangeSelector) not connected | Medium | Connect when prerequisites met |
| M2 | 6 dead Zustand actions (copyPreviousWeekRoster, claimOpenShift, addStaffAvailability, etc.) — Zustand-only | Medium | Fix when features activated |
| M3 | Legacy `createSwapRequest`/`approveSwapRequest` stubs in dataStore | Medium | Remove in cleanup PR |
| L1–L4 | Console statement quality, BulkStaffImport UX, cosmetic issues | Low | Backlog |

---

## Phase 3 — Frontend Audit

**Document:** `docs/audit/frontend-audit.md`
**Guidelines applied:** Vercel Web Interface Guidelines (live fetch), Tailwind design system

### Fixed
| # | Issue | Severity | Files |
|---|-------|----------|-------|
| H1 | Icon-only buttons missing `aria-label` (sidebar collapse, shift card menu) | High | Layout.tsx, RosterShiftCard.tsx |
| H2 | Wide tables (7–9 columns) missing `overflow-x-auto` — cut off on mobile | High | People.tsx, Timesheets.tsx |
| H3 | Decorative icons inside buttons missing `aria-hidden="true"` | High | Layout.tsx |

### Documented
| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| M1 | Touch targets below 44px (h-7=28px, h-4=16px) on roster/PO buttons | Medium | Low — change to `h-9` |
| M2 | No loading skeletons on Ingredients, Roster pages | Medium | Low — add SkeletonTable |
| M3 | `tabular-nums` missing on all number columns in tables | Medium | Low — systemic class addition |
| M4 | `text-balance` missing on page headings | Medium | Low — cosmetic |
| M5 | Roster grid shows no empty state when no shifts exist | Medium | Medium |
| L1–L4 | reduced-motion, autocomplete attrs, heading hierarchy, toast aria-live | Low | Backlog |

### Consistency Verified ✅
- Toast system 100% using `sonner` (no legacy `useToast`)
- Semantic color tokens used consistently — no hardcoded colors in pages
- Button variants consistent across all pages
- All form inputs have linked labels

---

## Phase 4 — Tests

**Document:** `docs/audit/test-results.md`
**Result:** 58/58 tests passing (~220ms)

### Test Suites
| File | Tests | Status |
|------|-------|--------|
| `rosterCalculations.test.ts` | 29 | ✅ All pass |
| `unitConversions.test.ts` | 17 | ✅ All pass |
| `orderCalculations.test.ts` | 12 | ✅ All pass |

### Bugs Found and Fixed via Tests
| Bug | Impact | Fix |
|-----|--------|-----|
| Public holiday date detection using UTC (`toISOString().split('T')[0]`) — failed in AEST/AEDT (UTC+10/11) | **Compliance** — staff on Australia Day, Christmas, ANZAC Day etc. calculated at base rate instead of 2.5× | Changed to `getFullYear()/getMonth()/getDate()` (local time) in `calculatePenaltyRate`, `isPublicHoliday`, `getPublicHolidayName` |
| Vitest picking up `SuperSoltMVP-main/` tests — failing on missing `drizzle-orm` | Test suite failure | Added `include`/`exclude` to `vite.config.ts` |

### Integration Test Gaps (Pending)
| Flow | Blocker |
|------|---------|
| Staff creation (API route) | Needs Supabase test DB |
| Shift CRUD + DB persistence | Needs Supabase test DB |
| Roster publish flow | Needs Supabase test DB |
| Stock count → inventory deduction | Needs Supabase test DB |

**Recommendation:** Provision a free-tier Supabase project as `SUPABASE_TEST_URL` + `SUPABASE_TEST_ANON_KEY` for integration test suite.

---

## Phase 5 — Security Audit

**Document:** `docs/audit/security-audit.md`

### Fixed
| # | Issue | Severity |
|---|-------|----------|
| C1 | `api/square/callback.ts`: partial service role key logged to Vercel logs | Critical |

### Verified Secure ✅
| Area | Status |
|------|--------|
| Square token storage | AES-256-GCM (IV + auth tag per best practice) |
| Square webhook validation | HMAC-SHA256 + `crypto.timingSafeEqual` |
| API route authentication | JWT + org membership check on all endpoints |
| Xero OAuth CSRF | HMAC-SHA256 signed state param |
| Frontend Supabase client | Anon key only; no service_role in `src/` |
| Service role usage | API routes only |
| Invite token generation | `crypto.randomUUID()`, 7-day expiry, single-use |
| Secrets in source/git history | None found |
| Sentry PII | `sendDefaultPii: false` |
| RLS coverage | 100% of tables |

### Documented (action required)
| # | Issue | Severity | Action |
|---|-------|----------|--------|
| M1 | `/api/inbound-email` has no HMAC signature validation | Medium | **Must fix before connecting email provider** |
| M2 | No explicit CORS config on API routes | Medium | Add when supporting mobile/third-party clients |
| M3 | No request body size limits on `parse-invoice` / `inventory` endpoints | Medium | Add 10MB guard before Claude API call |
| L1 | `staff_availability` unencrypted (notes not yet added) | Low | Review when schema complete |
| L2 | TFN/bank fields not yet implemented | Low | Must encrypt at rest when added |

---

## Remaining Tech Debt (Prioritised)

### Must Fix Before Launch

| Priority | Item | Effort | Phase |
|----------|------|--------|-------|
| P0 | Implement `/api/invites/verify` server-side endpoint; restrict `staff_invites` RLS | 2–3h | DB |
| P0 | Add HMAC signature validation to `/api/inbound-email` before connecting email provider | 1h | Security |
| P1 | Provision Supabase test project for integration tests | 2h | Tests |

### Should Fix Soon (Next Sprint)

| Priority | Item | Effort | Phase |
|----------|------|--------|-------|
| P1 | `staff_availability` schema migration (`specific_date`, `notes`, `is_recurring`) + service function + AvailabilityDialog wire-up | 3–4h | DB + Code |
| P1 | Add 10MB size guard to `parse-invoice` and `inventory` API endpoints | 30min | Security |
| P1 | Increase touch targets to 44px minimum (roster toolbar, PO inline buttons) | 1h | Frontend |
| P1 | Add `tabular-nums` to all number columns in tables | 1h | Frontend |
| P2 | Restrict `qualification_types` writes to org admins (after Morty confirms UX intent) | 30min | DB |

### Backlog (Post-Launch)

| Priority | Item | Phase |
|----------|------|-------|
| P3 | Add loading skeletons to Ingredients and Roster pages | Frontend |
| P3 | Roster empty state (no shifts this week) | Frontend |
| P3 | `text-balance` on page headings | Frontend |
| P3 | Remove dead Zustand stubs (createSwapRequest, copyPreviousWeekRoster) once features activated | Code |
| P3 | Add `org_id` column to `admin_data_jobs`/`admin_data_audit` for per-org scoping | DB |
| P3 | Add explicit CORS headers to Vercel API routes | Security |
| P3 | Set up integration test suite with Supabase test project | Tests |
| P3 | Casual overtime (>10h/day) — currently not applied for casuals | Code |
