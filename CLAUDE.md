# SuperSolt — Claude Code Configuration

Multi-venue restaurant operations SaaS. Pre-revenue MVP. Melbourne AU.

## Stack

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Radix
- State: Zustand (client) + TanStack React Query (server)
- Backend: Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- Deployment: Vercel
- POS: Square (OAuth2, AES-256-GCM encrypted tokens)
- Monitoring: Sentry
- Testing: Vitest + Testing Library

## Project Structure

```
src/
  components/    — UI components (forms, roster, inventory, forecast, shared, dev, onboarding)
  pages/         — Route pages (Dashboard, Sales, People, Payroll, inventory, menu, setup, auth)
  lib/           — Utilities, API clients, Supabase client, schemas, services, validation
  stores/        — Zustand stores (useRosterStore, useInvoiceIntakeStore)
  hooks/         — Custom hooks (useOrders, useLoadOrders, useMobile, useOnboardingRedirect)
  types/         — TypeScript types (cogs, labour, database)
supabase/
  migrations/    — SQL migrations (31+)
  functions/     — Edge Functions (Deno runtime)
  seed/          — Seed data
api/             — Vercel serverless functions (square, xero, parse-invoice, staff, inventory)
```

## Commands

```bash
npm run dev          # Dev server (localhost:8080)
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (run before every commit)
npm test             # Vitest
```

## Supabase

- Project ref: vcfmouckydhsmvfoykms
- 74 tables, 166 RLS policies, multi-tenancy via org_id + venue_id
- Every new table MUST have RLS policies — no exceptions
- After schema changes: `npx supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/types/database.ts`
- Edge Functions use Deno runtime with TypeScript

## Architecture

- Monolith — no microservices
- Zustand for client state, React Query for server state
- DB writes: Supabase first → Zustand store update
- RLS multi-tenancy: org_id scoping on every user-facing table
- Square tokens: AES-256-GCM encrypted at rest
- Path alias: @/_ → ./src/_
- API routes (/api/\*) only work on Vercel — use client-side Supabase calls for local dev

## Safety (NEVER violate)

- NEVER push to main — feature branches only (feat/, fix/, chore/)
- NEVER modify RLS without approval
- NEVER delete tables or drop columns
- NEVER commit secrets or API keys
- NEVER log unencrypted POS tokens
- NEVER store TFN/bank in plain text

## Code Standards

- TypeScript strict — avoid `any`, use typed Props interfaces
- React Hook Form + Zod for all forms
- Tailwind utilities + shadcn/ui — no custom CSS
- Mobile-first responsive
- Error boundaries on route-level components

## AU Compliance

- Fair Work: 3hr min casual, 38hr/week ordinary, penalty rates
- GST: 10% inclusive default, configurable per item
- TFN: validate, encrypt, never log
- FSANZ food safety: 2+4 cooling, temp logs

## Before Commit

```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Agent Delegation

- Database work → @"supabase-engineer (agent)"
- React/UI work → @"frontend-builder (agent)"
- Testing → @"test-writer (agent)"
- Code review → @"reviewer (agent)"
- Security check → @"security-auditor (agent)"

For parallel execution, use Agent Teams. Each specialist works in its own git worktree. Clear file boundaries — no two agents touch the same file.

## Compaction Guide

When context reaches 40%, run /compact with:

- Current task description
- Full list of modified files
- Next planned step
- Active constraints or blockers
  Preserve: all file paths, current test status, error messages, architectural decisions.

## Further Documentation

@.claude/rules/code-style.md
@.claude/rules/api-conventions.md
@.claude/rules/supabase.md
@.claude/rules/component-standards.md
