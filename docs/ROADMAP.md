# SuperSolt — Roadmap & Technical Debt

## Current Feature Status

### Fully Working (Production-Ready)

- ✅ Auth (login, signup, invite, password reset, email confirmation)
- ✅ Multi-org / multi-venue with RLS isolation
- ✅ Ingredient management with cost cascade
- ✅ Supplier management and price tracking
- ✅ Purchase Order lifecycle (create → approve → receive → cost update)
- ✅ Stock counts (multi-location, scheduled)
- ✅ Waste logging with FSANZ-compliant temperature records
- ✅ Invoice Intelligence (Claude Vision PDF/image parsing + line matching)
- ✅ Invoice reconciliation vs Purchase Orders
- ✅ Menu items and recipe builder with sub-recipe nesting
- ✅ Food cost analysis (COGS formula with waste deduction)
- ✅ Roster (DnD, templates, patterns, quick-build, copy week/day)
- ✅ Timesheets (generate from roster, approve/reject/adjust)
- ✅ Staff management (profiles, employment type, qualifications)
- ✅ Labour reports and payroll export CSV
- ✅ AU Fair Work penalty rates (casual Saturday/Sunday/PH)
- ✅ Availability and leave management
- ✅ Square POS OAuth + order sync
- ✅ Xero accounting integration (OAuth, sync, account mapping)
- ✅ Sales dashboard with demand forecast overlay
- ✅ Daybook (manager operations notes)
- ✅ Admin: org settings, venue settings, locations, access roles
- ✅ Data imports (CSV for ingredients, staff, menu items)
- ✅ Setup wizard for new orgs

### Partially Working

- ⚠️ `staff_availability` — UI works but `specific_date`, `notes`, `is_recurring` columns missing from DB schema. Needs migration before single-day overrides work.
- ⚠️ Email invoice ingestion — `processInboundEmail()` is a stub. The `/api/inbound-email/` endpoint receives emails but doesn't parse them.
- ⚠️ Casual overtime (>10h/day) — applied for full-time staff but NOT for casuals. Missing penalty calculation.

### Known Limitations

- No mobile responsive design (out of scope for MVP)
- Square POS: live connection, OAuth credentials, webhook sync, order history backfill not yet configured for production
- No automated testing (zero unit/integration tests)
- No CI pipeline

---

## Technical Debt

### High Priority

1. **`staff_availability` migration** — Add `specific_date` (date), `notes` (text), `is_recurring` (bool) columns. Service functions need rewriting to persist to DB (currently Zustand-only).

2. **Casual overtime** — `rosterCalculations.ts` needs overtime logic for casuals (OT after 10h/day in hospitality). Currently only full-time OT is calculated.

3. **Automated tests** — No test coverage. Critical paths to test first: cost cascade, penalty rate calculations, RLS isolation, auth flows.

### Medium Priority

4. **Dead store methods** — `claimOpenShift`, `createOpenShift`, `copyPreviousWeekRoster`, `deleteLaborBudget` exist in `dataStore.ts` but are not connected to any UI. Either wire them up or remove.

5. **Supplier edit page** — `SupplierDetail.tsx` is read-only. No dedicated supplier edit page exists. Workaround: edit from Suppliers list dialog. Cost cascade from supplier price changes works from Ingredients page and PO receiving, but not from a supplier-specific edit flow.

6. **`dataStore.ts` size** — At ~2800 lines, the main Zustand store is large. Consider splitting into domain-specific stores (inventoryStore, menuStore, labourStore) as the app grows.

### Low Priority

7. **`Payroll.tsx`** — Legacy page (`src/pages/Payroll.tsx`). The newer `PayrollExport.tsx` supersedes it. Evaluate if Payroll.tsx can be removed.

8. **`xero_connections` types** — Not yet in auto-generated `types.ts` (migration just pushed). Regenerate types after next deployment to get proper TypeScript types for Xero tables.

---

## Recommended Next Steps

### For the incoming developer:

1. **Regenerate Supabase types** after the Xero migration has been applied to production:

   ```bash
   supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/integrations/supabase/types.ts
   ```

2. **Configure Xero app credentials** in Vercel. See `docs/INTEGRATIONS.md` — Xero OAuth section.

3. **Configure ANTHROPIC_API_KEY** in Vercel for Invoice Intelligence.

4. **Fix `staff_availability`** — write the migration and service functions. See MEMORY.md in `.claude/` for full context.

5. **Set up CI** — Add GitHub Actions workflow: `npm run lint && npx tsc --noEmit && npm run build` on PR.

6. **User accounts for Damien & Stephen** — Create via Supabase Auth (Admin panel → Authentication → Users → Create User), then add `org_members` rows granting access to the relevant Piccolo Panini Bar orgs.

---

## Feature Ideas / Backlog

- MYOB integration (similar pattern to Xero)
- Deputy / Tanda roster sync
- Mobile app or PWA for floor staff
- Automated email invoice ingestion (implement `processInboundEmail()`)
- AI-powered ordering suggestions based on sales trends
- Customer loyalty integration
- Online ordering portal integration (Uber Eats, DoorDash)
- Multi-currency support (for future international expansion)
- Advanced forecasting (weather, events, seasonality)

---

## Pilot Organisations

| Org                            | ID                                     | Venues          |
| ------------------------------ | -------------------------------------- | --------------- |
| Piccolo Panini Bar Hawthorn    | `7062ac24-a551-458c-8c94-9d2c396024f9` | PPB Hawthorn    |
| Piccolo Panini Bar South Yarra | `c4f8a2e1-3b5d-4f9c-8e2a-7d6f1e4b3a8c` | PPB South Yarra |

Both created in staging (`vcfmouckydhsmvfoykms`). Morty (user `a6943bd2...`) is admin of both.
