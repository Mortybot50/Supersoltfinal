# SuperSolt — Setup Guide

## Prerequisites

- Node.js 18+
- npm (included with Node)
- Supabase CLI (`npm install -g supabase`)
- Git

---

## Clone & Install

```bash
git clone https://github.com/Mortybot50/Supersoltfinal.git
cd Supersoltfinal
npm install
```

---

## Environment Variables

Create `.env.local` in the project root:

```env
# Supabase — get from Supabase Dashboard > Project Settings > API
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...  # anon/public key

# Sentry (optional — error tracking)
# VITE_SENTRY_DSN=https://...@sentry.io/...
```

**Never** commit `.env.local`. The `.gitignore` excludes it.

### Vercel Environment Variables (serverless functions)

Set these in Vercel Dashboard > Project > Settings > Environment Variables:

| Variable                    | Description                                        | Required for         |
| --------------------------- | -------------------------------------------------- | -------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | Same as VITE_SUPABASE_URL                          | All API functions    |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secret!)                         | All API functions    |
| `ENCRYPTION_KEY`            | 64-char hex string for AES-256-GCM                 | Square + Xero tokens |
| `SQUARE_APP_ID`             | Square Developer App ID                            | Square OAuth         |
| `SQUARE_APP_SECRET`         | Square Developer App Secret                        | Square OAuth         |
| `SQUARE_ENVIRONMENT`        | `sandbox` or `production`                          | Square OAuth         |
| `XERO_CLIENT_ID`            | Xero Developer App Client ID                       | Xero OAuth           |
| `XERO_CLIENT_SECRET`        | Xero Developer App Secret                          | Xero OAuth           |
| `XERO_REDIRECT_URI`         | `https://your-domain.vercel.app/api/xero/callback` | Xero OAuth           |
| `APP_URL`                   | `https://your-domain.vercel.app`                   | OAuth callbacks      |
| `ANTHROPIC_API_KEY`         | Anthropic API key                                  | Invoice parsing      |

Generate ENCRYPTION_KEY:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Local Development

```bash
npm run dev
```

Opens at `http://localhost:8080`.

> Serverless functions in `/api/` do NOT run locally with `npm run dev`. Deploy to Vercel preview for end-to-end testing of Square/Xero OAuth.

---

## Supabase Setup

### Link to existing project

```bash
supabase login
supabase link --project-ref vcfmouckydhsmvfoykms
```

### Push migrations to remote

```bash
supabase db push --linked
```

### Pull latest schema changes

```bash
supabase db pull
```

### Regenerate TypeScript types

```bash
supabase gen types typescript --project-id vcfmouckydhsmvfoykms > src/integrations/supabase/types.ts
```

---

## Build, Lint & Type Check

```bash
# Development server
npm run dev

# Production build
npm run build

# Type check (no emit)
npx tsc --noEmit

# Lint
npm run lint

# Full pre-commit check (run all three)
npm run lint && npx tsc --noEmit && npm run build
```

Build output goes to `dist/`. Build time: ~3.5 seconds.

---

## Vercel Deployment

The project deploys automatically to Vercel on push to `main`.

### Manual deploy

```bash
npx vercel --prod
```

### Preview deploy (any branch)

```bash
npx vercel
```

### Deploy configuration

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- API routes: `api/**` → Vercel Functions (Node.js)

---

## Seed Data

The `supabase/org-setup.sql` script creates the Piccolo Panini Bar pilot organisations. It's idempotent (safe to re-run):

```bash
# Run via psql (get DB URL from Supabase Dashboard > Settings > Database)
psql "postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres" -f supabase/org-setup.sql
```

Or create it as a migration and push:

```bash
cp supabase/org-setup.sql supabase/migrations/YYYYMMDDHHMMSS_seed.sql
supabase db push --linked
```

---

## Feature Branches

All work goes on feature branches. Never commit directly to `main`.

```bash
git checkout -b feat/my-feature
# ... work ...
git push origin feat/my-feature
# Create PR via GitHub or: gh pr create
```

Branch naming: `feat/`, `fix/`, `chore/`
