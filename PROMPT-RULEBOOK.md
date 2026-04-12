# SuperSolt Prompt Rulebook

Quick reference — what to say to Claude Code and when.

---

## Rule 1: Match prompt complexity to task size

| Task Size                             | What To Do                       | Example                                                              |
| ------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| **Tiny** (typo, rename, one-liner)    | Just say it                      | "rename the Dashboard title to 'Overview'"                           |
| **Small** (single file, clear change) | Say what + where                 | "add a loading spinner to src/pages/Sales.tsx when data is fetching" |
| **Medium** (2-5 files, one domain)    | Say what + definition of done    | See templates below                                                  |
| **Large** (full-stack, multi-domain)  | Plan first, then build in phases | Use architect agent, then phased sessions                            |

---

## Rule 2: Always include the "done when" line

Bad: "add user settings"
Good:

```
Add a user settings page.
Done when:
- Settings page renders at /settings
- User can update display name and timezone
- Changes persist to Supabase
- npx tsc --noEmit passes
- npm run build passes
```

The "done when" list is the single biggest quality lever. Claude will self-check against it.

---

## Rule 3: Name files when you know them

Bad: "fix the roster bug"
Good: "fix the roster bug — the shift grid in src/components/roster/ShiftGrid.tsx crashes when roster data is empty"

The more specific the starting point, the less context Claude burns searching.

---

## Prompt Templates by Scenario

### New Feature (full-stack)

```
@"architect (agent)" plan the [feature name] feature:
- [what it does in 1-2 sentences]
- [any specific requirements]
- [any UI reference — "similar to the existing roster page"]
```

Review the plan. Then build in phases:

```
Phase 1: /db-migrate [table_name] — create the schema
/clear

Phase 2: Build the API layer for [feature].
Use the types from src/types/database.ts.
Done when: npx tsc --noEmit passes.
/clear

Phase 3: Build the [feature] page UI.
Use existing patterns from src/components/.
Done when: page renders, data loads, forms submit, mobile works.
/clear

Phase 4: @"validator (agent)" verify everything passes
```

### New Feature (frontend only)

```
Build [component/page description].
Location: src/components/[feature]/ or src/pages/[feature]/
Follow the patterns in [similar existing component].
Use shadcn/ui + Tailwind. React Hook Form + Zod for any forms.
Done when:
- Component renders with loading/error/empty states
- Mobile responsive (375px)
- npx tsc --noEmit passes
```

### New Feature (database only)

```
/db-migrate [description]
Requirements:
- [table structure or changes needed]
- RLS policies scoped to org_id + venue_id
- [any specific indexes or constraints]
```

### Bug Fix

```
Bug: [what's broken — paste the error or describe the behaviour]
Expected: [what should happen]
Actual: [what happens instead]
Location: [file path if known, or "somewhere in the roster feature"]

Fix it. Write a regression test. Don't refactor anything unrelated.
Done when: bug is fixed, test passes, npm run build passes.
```

### Bug Fix (with error output)

Pipe the error directly — don't describe it:

```
npm test 2>&1 | claude "fix the failing tests — here's the full output"
npx tsc --noEmit 2>&1 | claude "fix all type errors shown here"
```

### Refactor

```
Refactor [what] in [file/directory].
Goal: [why — performance, readability, consistency]
Constraint: behaviour must not change — existing tests must still pass.
Done when: tests pass, types pass, no new warnings.
```

### Quick UI Tweak

```
In src/components/[path], [change description].
```

That's it. No ceremony needed for small changes.

### Security Check

```
@"security-auditor (agent)" audit [area]:
- Focus on [RLS / auth / input validation / secret exposure]
- Check [specific files or flows]
```

### Code Review

```
@"reviewer (agent)" review my recent changes.
Focus on:
- TypeScript type safety
- Missing error handling
- Supabase RLS if schema changed
- Performance concerns
```

### Pre-Deploy

```
/deploy-check
```

### Database Migration

```
/db-migrate [description of what to add/change]
```

### Generate PR Description

```
/pr-summary
```

---

## Rule 4: Tell Claude what NOT to touch

When the change is scoped, say so:

```
Update the shift calculation in src/lib/services/roster.ts.
DO NOT modify any components or pages.
DO NOT change the database schema.
Only touch the service layer logic.
```

This prevents Claude from "helpfully" refactoring half the codebase.

---

## Rule 5: Paste data, don't describe it

Bad: "the API returns an error about permissions"
Good: "the API returns this error: [paste full error]"

Bad: "the types are wrong"  
Good: "npx tsc --noEmit shows: [paste output]"

Raw data > your interpretation. Claude can read stack traces better than you can describe them.

---

## Rule 6: One task per session

Bad:

```
Fix the roster bug, then add the settings page,
then update the dashboard chart, and also refactor the auth flow
```

Good:

```
Fix the roster bug in ShiftGrid.tsx — crashes on empty data.
```

Then `/clear`, then the next task. Each task gets fresh context and full attention.

---

## Rule 7: Use subagents for investigation

Don't pollute your main context with research:

```
Use a subagent to investigate how the Square OAuth refresh flow works
in this codebase and report back a summary.
```

The subagent reads 20 files in its own context. You get a 500-token summary.

---

## Rule 8: After Claude makes a mistake

Immediately say:

```
That's wrong. [Explain what's wrong].
Add a rule to .claude/rules/[relevant-file].md so this doesn't happen again.
```

Or for project-wide mistakes:

```
Update CLAUDE.md: never [do the thing] because [reason].
```

This is the compounding loop. Every correction becomes a permanent rule.

---

## Rule 9: Context management

| Situation                          | Action                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| Starting a new task                | `/clear`                                                   |
| Context warning appears (40%)      | `/compact focus on: [task], [files modified], [next step]` |
| Mid-task, need a side question     | `/btw [question]`                                          |
| Long task, might continue tomorrow | `/rename [descriptive-name]`                               |
| Resuming yesterday's work          | `claude --resume [name]`                                   |

---

## Rule 10: The "magic words" that unlock quality

These phrases measurably improve Claude's output:

| Phrase                                         | Why It Works                                  |
| ---------------------------------------------- | --------------------------------------------- |
| "Done when: [checklist]"                       | Claude self-validates against criteria        |
| "Read [file] first before changing it"         | Prevents blind edits                          |
| "Follow the patterns in [existing file]"       | Grounds output in your codebase               |
| "Use context7 for latest [library] patterns"   | Gets live docs instead of stale training data |
| "Don't report success until [conditions]"      | Prevents premature "all done!"                |
| "Fix any test failures before calling it done" | Creates the feedback loop (2-3x quality)      |
| "Use a subagent to investigate [X]"            | Preserves your main context                   |
| "Make the minimal change needed"               | Prevents scope creep                          |

---

## Cheat Sheet — Copy These Directly

**Start of day:**

```
cd ~/.openclaw/roles/dev/supersolt && claude
```

**New feature:**

```
@"architect (agent)" plan [feature]. [1-2 sentence description].
```

**Build it:**

```
Build [feature]. Done when: [checklist]. Follow patterns in [existing file].
Fix any failures before calling it done.
```

**Fix a bug:**

```
Bug: [paste error]. Fix it. Write a regression test. Done when tests pass.
```

**Before deploy:**

```
/deploy-check
```

**Context getting long:**

```
/compact focus on: [what I'm doing], files: [list], next: [what's next]
```

**End of session:**

```
/rename [descriptive-name]
```
