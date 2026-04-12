---
name: deploy-check
description: Use before deploying to Vercel, shipping to production, releasing a build, or going live. Runs all quality gates and reports pass/fail. Triggers on: deploy, ship, release, go live, push to production, pre-deploy, deploy check.
allowed-tools: Read, Grep, Glob, Bash
---

# Deploy Check Workflow

Run this before ANY deployment to production.

## Checks (all must pass)

```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Build
npm run build

# 4. Tests
npm test

# 5. Check for secrets
grep -r "sk-" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".env"
grep -r "supabase_service_role" src/ --include="*.ts" --include="*.tsx"

# 6. Check for console.logs (should be removed for production)
grep -rn "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20

# 7. Git status — no uncommitted changes
git status
```

## Report Format

```
DEPLOY CHECK RESULTS
Type check: PASS/FAIL
Lint: PASS/FAIL
Build: PASS/FAIL
Tests: PASS/FAIL (X passed, Y failed)
Secrets scan: CLEAN/FOUND (list any)
Console.logs: X found (list files)
Git status: CLEAN/DIRTY
VERDICT: SAFE TO DEPLOY / DO NOT DEPLOY
```

## If ANY check fails

Fix the issue before deploying. Do not skip checks.
