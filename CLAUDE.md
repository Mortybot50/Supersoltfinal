# CLAUDE.md — SuperSolt Project Guidelines

## Project
Multi-venue restaurant operations SaaS. React + TypeScript + Supabase + Vercel. Pre-revenue MVP.

## Safety (Non-Negotiable)
- NEVER push directly to main branch
- NEVER modify or drop RLS policies without explicit approval from Morty
- NEVER delete or drop database tables
- NEVER modify Supabase environment variables
- NEVER commit secrets, API keys, or connection strings
- NEVER log decrypted POS tokens (AES-256-GCM encrypted in pos_connections)
- NEVER store TFN, bank details, or sensitive PII in plain text

## Coding Standards
- TypeScript strict mode, Zod validation for all external data
- Every new table MUST have RLS policies (org_id + venue_id scoped)
- All DB writes: Supabase first → then update Zustand store
- Before committing: npm run lint && npx tsc --noEmit && npm run build
- Feature branches only: feat/, fix/, chore/

## Architecture
- Monolith first — no microservices
- Zustand for client state, React Query for server state
- RLS-based multi-tenancy (org_id on every table)
- Square tokens encrypted at rest (AES-256-GCM)

## AU Compliance
- Fair Work: 3h minimum casual engagement, 38h/week max ordinary, penalty rates
- GST/BAS: quarterly cycle, GST-inclusive vs exclusive pricing
- TFN: format validation, encrypt at rest, never log plain text
- Food Safety: FSANZ, 2+4 cooling rule, temp logs

## Workflow
- Work autonomously on feature branches — no approval needed
- Create PRs when work is done — Morty will review when he's ready
- If something breaks (build fails, type errors), fix it before reporting back
- For genuinely irreversible decisions (new vendor, dropping a module, changing auth provider), flag it in the PR description