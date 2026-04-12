---
paths:
  - "src/api/**/*.ts"
  - "src/lib/api/**/*.ts"
  - "src/lib/services/**/*.ts"
  - "api/**/*.ts"
---

# API Development Rules

- Validate all inputs with Zod before processing
- Return consistent error shape: `{ error: string, code: string, details?: unknown }`
- Use typed responses — no `any` return types
- Auth check before any data access
- Log all errors with full context (never swallow)
- Rate limit sensitive endpoints
- Use parameterised queries — no raw SQL concatenation
