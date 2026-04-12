---
paths:
  - "src/components/**/*.tsx"
  - "src/pages/**/*.tsx"
---

# Component Standards

- Use shadcn/ui components + Tailwind — no custom CSS
- Export Props interface alongside component
- All interactive elements need aria labels
- Handle loading + error + empty states — never just happy path
- Mobile-first responsive (test at 375px then 1280px)
- React Hook Form + Zod for all forms
- Use React Query hooks for data fetching, Zustand for client state
- Error boundaries on route-level components
