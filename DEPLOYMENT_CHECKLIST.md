# SuperSolt Deployment Checklist

## Supabase Setup

- [ ] Create production Supabase project
- [ ] Run all migrations in order:
  - `20250203000000_mvp_schema.sql` — base schema (53 tables)
  - `20250203000001_fix_rls_policies.sql` — RLS policies for all tables
  - `20250203000002_mvp_schema_fixed.sql` — schema fixes
  - `20250203000003_fix_signup_rls.sql` — signup flow RLS
  - `20250208000000_labour_enhancements.sql` — labour module tables
- [ ] Verify RLS policies active on all tables
- [ ] Create storage buckets: documents (private), photos (public)
- [ ] Set up email templates (password reset, invite)

## Environment

- [ ] Set VITE_SUPABASE_URL in hosting environment
- [ ] Set VITE_SUPABASE_PUBLISHABLE_KEY in hosting environment

## First Run

- [ ] Create owner account via signup
- [ ] Set up organisation details
- [ ] Configure venue settings (trading hours, targets, timezone)
- [ ] Set up storage locations
- [ ] Import initial data: ingredients, suppliers
- [ ] Import TASK POS sales data
- [ ] Create staff records
- [ ] Build first roster
- [ ] Run first stock count

## Smoke Test

- [ ] Login works
- [ ] Dashboard shows imported data
- [ ] Can create/edit/delete ingredient
- [ ] Can create recipe with costing
- [ ] Can create roster with penalty rates
- [ ] Can import TASK POS file
- [ ] Can log waste
- [ ] Can create PO
- [ ] Settings save and persist
