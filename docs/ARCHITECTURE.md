# SuperSolt — Architecture Overview

## Platform Summary

Multi-venue restaurant operations SaaS. Pre-revenue MVP targeting Australian hospitality venues.
**Stack**: React + TypeScript (strict) + Supabase + Vercel

---

## Tech Stack

| Layer          | Technology                          | Notes                        |
| -------------- | ----------------------------------- | ---------------------------- |
| Frontend       | React 18, TypeScript strict, Vite   | SPA, no SSR                  |
| UI             | Shadcn/ui (Radix UI + Tailwind CSS) | Component library            |
| Routing        | React Router v6                     | Nested layouts               |
| Server state   | TanStack React Query                | Caching, background refetch  |
| Client state   | Zustand                             | Global store for app data    |
| Forms          | react-hook-form + Zod               | Validation at all inputs     |
| Database       | Supabase (PostgreSQL)               | Hosted, managed              |
| Auth           | Supabase Auth                       | JWT-based, RLS enforcement   |
| Storage        | Supabase Storage                    | Invoice file uploads         |
| Serverless     | Vercel Functions (Node.js)          | `/api/*` routes              |
| Charts         | Recharts                            | Sales, labour, cost charts   |
| DnD            | @dnd-kit                            | Roster drag-and-drop         |
| Error tracking | Sentry                              | Optional via VITE_SENTRY_DSN |
| CI             | GitHub → Vercel auto-deploy         | No CI pipeline yet           |

---

## Repository Structure

```
supersolt/
├── api/                    # Vercel serverless functions
│   ├── square/             # Square POS OAuth + sync
│   ├── xero/               # Xero accounting OAuth + sync
│   ├── parse-invoice/      # Claude Vision invoice parsing
│   ├── inbound-email/      # Email invoice ingestion (stub)
│   └── staff/              # Staff onboarding helpers
├── src/
│   ├── App.tsx             # Root routes (all pages lazy-loaded)
│   ├── components/         # Shared components
│   │   ├── ui/             # Shadcn primitives
│   │   ├── shared/         # PageShell, PageToolbar, etc.
│   │   ├── roster/         # Roster-specific components
│   │   ├── inventory/      # Inventory components
│   │   └── forms/          # Reusable form components
│   ├── contexts/
│   │   └── AuthContext.tsx # Org/venue/user auth state
│   ├── hooks/              # App-level hooks
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts   # Typed Supabase client
│   │       └── types.ts    # Auto-generated DB types
│   ├── lib/
│   │   ├── hooks/          # Data hooks (React Query)
│   │   ├── services/       # DB service functions
│   │   ├── store/
│   │   │   └── dataStore.ts  # Main Zustand store (~2800 lines)
│   │   └── utils/          # Formatters, calculations
│   ├── pages/              # Route page components
│   ├── stores/
│   │   └── useRosterStore.ts  # Roster-specific Zustand store
│   └── types/              # TypeScript type definitions
├── supabase/
│   ├── migrations/         # Ordered SQL migration files
│   └── org-setup.sql       # Repeatable org seed script
└── docs/                   # This documentation
```

---

## Data Flow

### Read (server → client)

```
Supabase DB → React Query hooks (useXxx) → component props
         OR
Supabase DB → dataStore.ts (Zustand) → useDataStore() → component
```

React Query is used for frequently-refetched, paginated, or background-refresh data (orders, labour metrics, COGS). Zustand `dataStore` is used for reference data loaded once per session (ingredients, suppliers, staff, menu items, recipes).

### Write (client → server)

```
User action → service function → supabase.from(...).insert/update/delete
                               → on success: Zustand store setter (addX/updateX/deleteX)
                               → toast notification
```

**Rule**: Always write to Supabase FIRST, then update Zustand. Never update Zustand optimistically without a DB write.

---

## Auth & Multi-Tenancy

- Supabase Auth handles login, signup, session refresh, OAuth
- Every user has a `profiles` row and one or more `org_members` rows
- `org_members.role` = `admin` | `manager` | `staff`
- RLS on every table: `org_id IN (SELECT get_user_org_ids())`
- Venue-level access: `venue_access` table gates which venues a user can see
- `AuthContext.tsx` exposes: `{ user, currentOrg, currentVenue, orgs, venues, setCurrentOrg, setCurrentVenue }`

### RLS Helper Functions

```sql
get_user_org_ids()     → returns UUID[] of orgs the user belongs to
get_user_venue_ids()   → returns UUID[] of venues the user can access
is_org_admin(org_id)   → returns boolean
```

---

## State Management Strategy

| Store               | Contents                                                   | When to use              |
| ------------------- | ---------------------------------------------------------- | ------------------------ |
| `AuthContext`       | User, org, venue selection                                 | Auth-gated components    |
| `dataStore.ts`      | Ingredients, suppliers, staff, menu, invoices, POs, orders | Reference data, CRUD     |
| `useRosterStore.ts` | Roster shifts, open shifts, patterns                       | Roster page only         |
| React Query         | Labour metrics, COGS, inventory metrics                    | Real-time dashboard data |

---

## Bundle Architecture

Route-level code splitting via `React.lazy()`. All 40 page routes are lazy-loaded.

Vendor chunks split in `vite.config.ts`:

- `vendor-charts` — recharts (434 kB)
- `vendor-csv` — xlsx + papaparse (424 kB)
- `vendor-react` — react core (165 kB)
- `vendor-radix` — Radix UI (158 kB)
- `vendor-supabase` — @supabase/supabase-js (156 kB)

Main bundle: **247 kB (67 kB gzip)** at login time. Pages load on demand.

---

## API Pattern (Serverless Functions)

All `/api/*` functions follow this pattern:

1. Validate HTTP method
2. Extract and verify Supabase JWT (`verifyUser()`)
3. Check org access (`checkOrgAccess()`)
4. Perform business logic
5. Return JSON response

Sensitive tokens (Square, Xero) stored AES-256-GCM encrypted in DB. Decryption only in serverless functions, never client-side.

See `api/square/_lib.ts` and `api/xero/_lib.ts` for shared helpers.
