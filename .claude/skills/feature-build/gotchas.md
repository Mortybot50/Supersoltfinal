# Feature Build Gotchas — Know These Before Starting

1. **API routes don't work locally**: `/api/*` routes only work on Vercel. For local dev, use client-side Supabase calls directly. Don't waste time debugging 404s on localhost.

2. **Type generation after schema changes**: After ANY migration, you MUST run `npx supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/types/database.ts` or TypeScript will have stale types. This has caused multiple bugs.

3. **RLS on new tables**: Forgetting RLS policies on new tables means the data is accessible to everyone. Every new table needs `ALTER TABLE x ENABLE ROW LEVEL SECURITY` + org_id/venue_id scoped policies.

4. **Path alias**: Use `@/` for imports (maps to `./src/*`). Don't use relative paths like `../../lib/`.

5. **State management split**: Server state = React Query. Client state = Zustand. Don't use Zustand for data that comes from the API — that's React Query's job. Mixing them causes stale data bugs.
