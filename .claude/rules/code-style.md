# Code Style — React/TypeScript

- TypeScript strict mode: `"strict": true` in tsconfig.json
- No `any` — use `unknown` and narrow with type guards
- Prefer `interface` over `type` for object shapes
- Functional components only — no class components
- Custom hooks in `src/hooks/` prefixed with `use`
- Tailwind for all styling — no inline styles, no CSS modules
- Named exports only — no default exports
- Import order: React → external libs → internal → relative
- Use `cn()` utility for conditional Tailwind classes
- Props interfaces must be exported and named `ComponentNameProps`
