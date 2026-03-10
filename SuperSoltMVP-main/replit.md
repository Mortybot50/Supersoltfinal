# Next.js 14 Hospitality Operations Dashboard

## Overview
This project is a production-ready hospitality operations dashboard built with Next.js 14. Its core purpose is to equip hospitality venues with a comprehensive tool for monitoring key operational metrics, streamlining staff management, tracking labor, and managing inventory for demand forecasting. The dashboard aims to significantly enhance efficiency and decision-making by providing insights into sales performance, product analytics, labor management, and inventory control, all presented within a dark-themed interface with extensive navigation.

## Recent Changes

### PROMPT 12/20 - Nightly Jobs & Demand Signals (Completed: October 24, 2025)
**Features Delivered:**
- **Demand Signals Scaffolding**: Extensible system for applying forecast multipliers via manual overrides, holidays, and weather (scaffold)
  - `lib/signals/` provider architecture with three signal sources: manual overrides, public holidays (+15% bump), weather adapter (neutral placeholder)
  - Multipliers combined multiplicatively with safety bounds (0.5x - 1.8x) to prevent extreme adjustments
  - Integrated into `generateDailyForecast()` - applied per-day before storing forecasts
- **Manual Demand Overrides UI**: `/automation/demand-overrides` page for creating time-window multipliers
  - CRUD operations with date/time pickers, multiplier input (0.1-5.0), and reason notes
  - API routes: `GET/POST /api/demand-overrides`, `DELETE /api/demand-overrides/[id]`
  - Proper auth via `getActiveContext()`, table with creator tracking
- **Nightly Jobs Orchestration**: `lib/jobs.ts` with `runNightlyJobs()` function
  - Regenerates forecasts for next 14 days for all venues
  - Runs window-aware guardrails (price nudges, order shortfalls, labour suggestions) for next 7 days
  - Deduplicates suggestions before insertion (marks old NEW suggestions as IGNORED by type+payload key)
  - Cron endpoints: `POST /api/cron/nightly` (protected with `x-cron-secret` header), `POST /api/cron/forecast` (supports both cron mode and user auth)
- **Dev Unlock Utility**: `POST /api/dev/activate-context` auto-sets org/venue cookies from first membership
  - Unblocks testing without manual venue selection
  - Uses both legacy (`orgId`/`venueId`) and new (`activeOrgId`/`activeVenueId`) cookie names for compatibility
- **Schema Additions**: `demand_overrides` and `holidays` tables with proper indexes

**Security & Production-Ready:**
- Cron endpoints require `x-cron-secret` header (defaults to `dev-cron-secret-change-in-prod` if env var not set)
- Suggestion deduplication prevents data flood from repeated nightly runs
- All API routes use `getActiveContext()` for proper venue isolation

**Acceptance Verified:**
- Manual override creation flow works end-to-end
- Forecast regeneration applies demand multipliers correctly
- Nightly jobs complete successfully with deduplication
- Dev unlock route activates context for testing

### PROMPT 10/20 - Waste Management Module (Completed: October 24, 2025)
**Features Delivered:**
- Complete waste tracking system with `/inventory/waste` page featuring DateNav filtering (Day/Week/Month)
- AddWasteModal component for logging waste events with ingredient selection, quantity, unit, reason, and notes
- Real-time waste cost calculation using historical cost snapshots via `getIngredientUnitCostCentsSnapshot()`
- Summary cards showing total waste cost and top waste offenders
- Stock movement integration (negative movements for waste events)
- Dev seed route `/api/dev/seed/waste-fixtures` for testing with realistic chicken and lettuce fixtures

**Critical Bugs Fixed:**
1. **Cost Convention Enforcement**: Corrected `unitPriceCents` in `ingredient_suppliers` to be per BASE UNIT (gram/each), not per pack
2. **Idempotent Seed Route**: Updated `upsertIngredient()` and `ensureIngredientSupplier()` helpers to UPDATE existing records instead of just returning them
3. **AddWasteModal Query Bug**: Fixed to expect plain array from `/api/ingredients` (was expecting wrapped object)
4. **Dashboard Performance**: Optimized `/api/dashboard/summary` to batch queries and parallelize COGS/labour/top products calculations (target <800ms)
5. **Empty State UX**: Added helpful hint to waste page when no ingredients exist, guiding users to seed route or CSV import

**Cost Calculation Verified:**
- Chicken Breast (500g @ 1¢/g) = A$5.00 ✓
- Cos Lettuce (2 each @ 150¢/each) = A$3.00 ✓

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
The application is built with Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, TanStack Table, and Recharts.

### UI/UX Decisions
- **Theme**: Features a light "glow" theme with dark mode support, using a lime green (#68E365) accent and soft glow effects.
- **Color Palette**: Semantic HSL color tokens, including `--surface`, `--text`, `--accent-fg`, `--accent-soft`, and `--glow-sm/md/lg`.
- **Typography**: Uses the Inter font family.
- **Components**: Utilizes over 40 shadcn/ui components for a consistent design system.
- **Navigation**: Collapsible, grouped sidebar with 7 main sections, driven by `app/nav.config.ts`, and a top bar for selectors and theme toggling.

### Technical Implementations
- **Authentication**: Auth.js (NextAuth v5) with Credentials provider, bcrypt hashing, JWT sessions, middleware protection, and a password reset flow with SHA-256 tokens and email recovery.
- **Data Fetching**: TanStack Query v5 for efficient data management.
- **Data Tables**: TanStack Table v8 for sortable and filterable data displays.
- **Charts**: Recharts for data visualization, particularly sales vs. forecast.
- **Database**: PostgreSQL with Drizzle ORM, featuring a comprehensive schema for hospitality operations including users, organizations, staff, inventory, sales, and more, all with UTC timestamp support.
- **API Routes**: Structured API endpoints for various functionalities like dashboard metrics, automation, attendance, labor, payroll, menu items, ingredients, recipes, sales, forecasting, inventory, purchases, authentication, and development utilities. All KPIs support period-based filtering.
- **Validation**: Zod schemas for server-side validation across all API endpoints.
- **Authorization**: Custom helpers for organization and role-based access control, ensuring tenant isolation and secure session management via HTTP-only cookies.
- **State Management**: Client-side providers for session, query client, and theme.
- **Error Handling**: Robust 401/403 error handling for authentication and authorization.

### Feature Specifications
- **Dashboard**: Client-rendered, dynamic dashboard with period selection, KPI cards (Sales, COGS, Labour %), Sales vs. Forecast charts, AI suggestions, and Product Performance.
- **Labour Management**: Includes a weekly roster grid with publish/unpublish workflow, templating system, real-time labour overlay against forecasts, AI-driven shift suggestions, and payroll export to various accounting systems (Xero, KeyPay, MYOB).
- **Timesheets**: Manages clock-in/out times, hours, breaks, and supports approval/rejection workflows.
- **Inventory Management**: Comprehensive CRUD for Menu Items, Ingredients, and Recipes (including nested ones). Manual Daily Sales entry for demand forecasting. Features an Order Guide that generates forecast-based purchasing suggestions, including Bill of Materials (BOM) calculation, stock comparison, safety stock, pack quantity recommendations, supplier prioritization, and CSV export. Purchase Order lifecycle management (DRAFT→SENT→PARTIAL/RECEIVED/CANCELLED) with stock movements and weighted average cost calculations.
- **CSV Data Imports**: Idempotent, two-phase import system (preview/commit) for various entities (Sales, Suppliers, Ingredients, Menu Items & Recipes, Staff, Stock on Hand) with Zod-based validation and downloadable templates.

### System Design Choices
- **Strict TypeScript**: Ensures high type safety.
- **Monorepo Structure**: Organized `app/`, `components/`, `db/`, `lib/`, and `public/` directories.
- **Code Quality**: Enforced via ESLint, Prettier, Husky, and lint-staged.
- **Security**: Focus on tenant isolation, robust authorization, audit logging, and HTTP-only cookies for session management.

## External Dependencies
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Data Fetching**: TanStack Query v5
- **Data Tables**: TanStack Table v8
- **Charting**: Recharts
- **Error Tracking**: Sentry
- **Analytics**: PostHog
- **Testing**: Jest, React Testing Library, Playwright
- **Code Quality**: ESLint, Prettier, Husky, lint-staged