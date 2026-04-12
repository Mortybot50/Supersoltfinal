# Bug Fix Gotchas — Common Traps in SuperSolt

1. **Stale types after migration**: If types look wrong after a schema change, check if `npx supabase gen types typescript` was run. Stale `src/types/database.ts` is the #1 cause of "type X doesn't have property Y" bugs.

2. **RLS hiding data**: If a query returns empty results that should have data, check RLS policies first. Missing or incorrect org_id/venue_id policies silently filter out rows.

3. **API routes 404 locally**: `/api/*` routes only work on Vercel. If testing locally, the endpoint won't exist. Use direct Supabase client calls for local dev.

4. **Zustand vs React Query staleness**: If UI shows stale data after a mutation, check if the React Query cache is being invalidated. Don't manually update Zustand stores with server data — invalidate the query instead.

5. **Square token errors**: If Square API calls fail with auth errors, the encrypted token may have expired. Tokens need refreshing — check the OAuth refresh flow in `src/lib/api/square.ts`.
