---
description: Generate a pull request description for the current branch
---

Generate a PR description for the current branch vs main:

1. `git log origin/main..HEAD --oneline` — list commits
2. `git diff origin/main...HEAD --stat` — files changed
3. `git diff origin/main...HEAD` — full diff for context

Write a PR description with:

- **Summary**: 1-2 sentence overview
- **Changes**: bullet list of what changed
- **Testing**: how to test this change
- **Screenshots**: [placeholder — add before submitting]
- **Breaking Changes**: list any or "None"
- **Database**: list any migration files added or "No schema changes"
