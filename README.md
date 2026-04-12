# SuperSolt

Multi-venue restaurant operations & financial management platform for Australian hospitality businesses.

## Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Frontend   | React 18 + TypeScript 5, Vite           |
| Styling    | Tailwind CSS + shadcn/ui (Radix)        |
| State      | Zustand (client) + React Query (server) |
| Backend    | Supabase (PostgreSQL + Auth + RLS)      |
| Deployment | Vercel                                  |
| POS        | Square (OAuth2, encrypted tokens)       |

## Getting Started

### Prerequisites

- Node.js >= 18
- npm

### Setup

```bash
git clone https://github.com/Mortybot50/Supersoltfinal.git
cd Supersoltfinal
npm install
cp .env.example .env.local
# Fill in your Supabase and Square credentials in .env.local
npm run dev
```

### Available Scripts

| Command            | Description      |
| ------------------ | ---------------- |
| `npm run dev`      | Start dev server |
| `npm run build`    | Production build |
| `npm run lint`     | ESLint check     |
| `npx tsc --noEmit` | Type check       |

## Project Structure

```
src/
├── components/          # UI components (shadcn/ui based)
│   ├── shared/          # Reusable: PageShell, PageToolbar, MetricCard, DataTable
│   ├── roster/          # Roster-specific components
│   └── ui/              # shadcn/ui primitives
├── pages/               # Route pages grouped by module
│   ├── workforce/       # People, Roster, Timesheets, Availability
│   ├── inventory/       # Ingredients, Stock Counts, POs, Waste
│   ├── menu/            # Recipes, Menu Items
│   ├── insights/        # P&L, Inventory Insights
│   ├── operations/      # Daybook
│   ├── admin/           # Settings, Access Roles, Integrations
│   └── onboarding/      # Employee onboarding wizard
├── lib/
│   ├── store/           # Zustand central store
│   ├── services/        # DB operations + business logic
│   ├── hooks/           # React Query hooks
│   └── utils/           # Formatters, validators, calculations
├── contexts/            # React contexts (Auth)
├── stores/              # Feature-specific Zustand stores
└── integrations/        # Supabase client + auto-generated types
```

## Architecture

### Key Patterns

- **DB-first writes**: All mutations go to Supabase first, then update Zustand (ADR-002)
- **Multi-tenancy**: Row Level Security on all tables, scoped by `org_id` + `venue_id`
- **State separation**: Zustand for UI state, React Query for server state
- **POS security**: Square OAuth2 tokens encrypted with AES-256-GCM at rest

### Database

- 59+ PostgreSQL tables with full RLS policies
- Migrations in `supabase/migrations/`
- Auto-generated types: `src/integrations/supabase/types.ts` (do not edit manually)

## Modules

- **Dashboard** — KPIs, sales trends, labour costs, forecasts
- **Sales** — Revenue analytics by channel, payment method, time period
- **Labour** — Hours & cost reports, labour %, rostered vs actual, overtime tracking
- **Inventory** — Stock counts, purchase orders, order guide, waste tracking, invoice parsing
- **Menu** — Recipe builder, food cost %, GP% targeting
- **Workforce** — Staff management, rostering, timesheets, availability, payroll export
- **Operations** — Daily daybook, checklists
- **Onboarding** — Employee self-service onboarding with document collection

## License

Private — all rights reserved.
