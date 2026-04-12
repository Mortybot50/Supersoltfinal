---
description: Create and apply a new Supabase migration
---

Create a new Supabase migration for: $ARGUMENTS

Steps:

1. Check current schema: read recent files in `supabase/migrations/`
2. Create migration file: `supabase/migrations/$(date +%Y%m%d%H%M%S)_$(echo "$ARGUMENTS" | tr ' ' '_' | tr '[:upper:]' '[:lower:]').sql`
3. Write the SQL with:
   - Table/column changes
   - RLS policies for any new tables (org_id + venue_id scoping)
   - Indexes for columns used in WHERE clauses
   - Comments on complex columns
4. Validate locally: `npx supabase db push --dry-run`
5. Apply migration: `npx supabase db push`
6. Regenerate types: `npx supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/types/database.ts`
7. Check for type errors: `npx tsc --noEmit`
8. Report: migration applied, types updated, any TypeScript changes found
