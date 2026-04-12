---
paths:
  - "supabase/**"
  - "src/lib/supabase*"
---

# Supabase Rules

- Never write raw SQL in app code — use Supabase client or typed RPC calls
- All migrations in `supabase/migrations/` with timestamp prefix
- RLS policies required on all new tables — org_id + venue_id scoping
- After schema changes: `npx supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/types/database.ts`
- Test migrations locally: `npx supabase db push --dry-run`
- Never use service role key client-side
- Edge Functions use Deno runtime — import from `https://esm.sh/`
