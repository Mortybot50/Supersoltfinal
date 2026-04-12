---
description: Pre-deployment checklist — runs all quality gates before deploying to Vercel
---

Run a complete pre-deployment check for $ARGUMENTS (or current branch if not specified):

1. TypeScript: `npx tsc --noEmit`
2. Lint: `npm run lint`
3. Tests: `npm test`
4. Build: `npm run build`
5. Check for secrets: `grep -rn "sk-\|supabase_service_role\|SUPABASE_SERVICE_ROLE" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
6. Check for console.logs: `grep -rn "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -20`
7. Git status: `git status`

Report format:

```
DEPLOY CHECK: $ARGUMENTS
Type check: PASS/FAIL
Lint: PASS/FAIL
Tests: PASS/FAIL (X passed, Y failed)
Build: PASS/FAIL
Secrets scan: CLEAN/FOUND
Console.logs: N found
Git status: CLEAN/DIRTY
VERDICT: SAFE TO DEPLOY / DO NOT DEPLOY
```

If any step fails, stop and report what failed with the exact error. Do not skip checks.
