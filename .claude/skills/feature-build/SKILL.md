---
name: feature-build
description: Use when building new features, implementing pages, creating components, adding functionality, or doing end-to-end full-stack work. Triggers on: build, implement, add, create, new feature, new page, new component, full-stack, end-to-end.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, MultiEdit
argument-hint: [feature-description]
effort: high
---

Build the feature described in $ARGUMENTS following this sequence:

### Phase 1: Plan

- Analyze requirements and identify affected files
- Read existing related code to understand patterns
- List every file to create or modify
- If task spans DB + API + UI, delegate to subagents

### Phase 2: Database (if needed)

- Create migration in `supabase/migrations/`
- Add RLS policies (org_id + venue_id scoping)
- Run `npx supabase db push`
- Regenerate types: `npx supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/types/database.ts`

### Phase 3: API Layer (if needed)

- Create typed API functions in `src/lib/api/`
- Add Zod validation schemas
- Use generated Supabase types

### Phase 4: Frontend

- Build React components with TypeScript + Tailwind + shadcn/ui
- Wire up React Query hooks for data fetching
- Use context7 for latest React/Tailwind patterns if unsure

### Phase 5: Verify

```bash
npx tsc --noEmit && npm run lint && npm run build && npm test
```

### Rules

- Mobile-first (375px → 1280px)
- No `any` types — use proper interfaces
- Handle loading + error + empty states
- Branch: `feat/feature-name`
- Read gotchas.md before starting
