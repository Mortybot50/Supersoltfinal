---
name: bug-fix
description: Use when fixing bugs, debugging errors, resolving test failures, investigating unexpected behavior, or troubleshooting issues. Triggers on: fix, bug, error, broken, not working, debug, failing, crash, regression, unexpected.
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
effort: medium
---

Fix the bug described in $ARGUMENTS following this process:

### Step 1: Reproduce

- Understand the error from the report or logs
- Find the relevant source files
- Trace the error path through the code
- If possible, write a failing test that captures the bug

### Step 2: Isolate Root Cause

- Identify the exact line(s) causing the issue
- Understand WHY it's broken, not just WHERE
- Check if this is a regression (was it working before?)
- Read gotchas.md — the bug may be a known pattern

### Step 3: Fix

- Make the minimal change needed
- Don't refactor unrelated code in the same fix
- If the fix requires a migration, create one with RLS policies

### Step 4: Verify

```bash
npx tsc --noEmit     # Must pass
npm run build        # Must pass
npm test             # Must pass
```

### Step 5: Add Regression Test

- If no test covers this case, write one
- Test should fail without the fix, pass with it

### Step 6: Commit

- Branch: `fix/bug-description`
- Commit message: explain what was broken and why the fix works
