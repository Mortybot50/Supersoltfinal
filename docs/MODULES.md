# SuperSolt — Module Developer Guide

## Module Map

| Module               | Route prefix            | Key files                                            |
| -------------------- | ----------------------- | ---------------------------------------------------- |
| Dashboard            | `/`                     | `src/pages/Dashboard.tsx`                            |
| Sales                | `/sales`                | `src/pages/Sales.tsx`                                |
| Inventory            | `/inventory/*`          | `src/pages/inventory/*`, `src/pages/Ingredients.tsx` |
| Menu & Costing       | `/menu/*`               | `src/pages/MenuItems.tsx`, `src/pages/menu/*`        |
| Labour / Roster      | `/workforce/*`          | `src/pages/labour/*`, `src/stores/useRosterStore.ts` |
| Invoice Intelligence | `/inventory/invoices/*` | `src/pages/inventory/Invoice*.tsx`                   |
| Operations           | `/operations/*`         | `src/pages/operations/*`                             |
| Admin                | `/admin/*`              | `src/pages/admin/*`                                  |
| Setup Wizard         | `/setup`                | `src/pages/setup/SetupWizard.tsx`                    |

---

## Dashboard

**Route**: `/` and `/dashboard`

**Key files**:

- `src/pages/Dashboard.tsx`
- `src/lib/hooks/useInventoryMetrics.ts`
- `src/lib/hooks/useLabourMetrics.ts`
- `src/lib/hooks/useCOGSMetrics.ts`

**Data sources**: React Query hooks fetching aggregated metrics from Supabase. Falls back to empty state for new orgs. KPI cards use skeleton loading.

---

## Inventory Module

### Ingredients (`/inventory/ingredients`)

- `src/pages/Ingredients.tsx` — CRUD, cost cascade trigger
- `src/lib/services/costCascade.ts` — BFS cascade recalculates recipe costs when ingredient price changes
- `src/lib/services/recipeService.ts` — recipe/sub-recipe operations

**Cost cascade flow**:

1. User updates ingredient price (in Ingredients page or PO receiving)
2. `triggerCostCascade(ingredientId)` called
3. BFS traverses recipes → sub-recipes → parent recipes
4. Each recipe's `cost_per_serve` recalculated
5. `persistCascadeResults()` writes all updated recipes to DB

### Suppliers (`/suppliers`)

- `src/pages/Suppliers.tsx` — list view
- `src/pages/SupplierDetail.tsx` — detail, can trigger price changes

### Purchase Orders (`/inventory/purchase-orders`)

- `src/pages/inventory/PurchaseOrders.tsx` — list with status filter
- `src/pages/inventory/PurchaseOrderDetail.tsx` — detail, approve/receive flow
- `src/pages/inventory/POReceiving.tsx` — GRN receipt, `quantity_received` recorded, triggers price cascade

### Stock Counts (`/inventory/stock-counts`)

- `src/pages/inventory/StockCounts.tsx` — count session list
- `src/pages/inventory/NewStockCount.tsx` — count entry form per location/bin

### Food Cost Analysis (`/inventory/food-cost`)

COGS formula: `Opening Stock + Purchases − Closing Stock − Waste`

- `src/pages/inventory/FoodCostAnalysis.tsx`
- Uses `useCOGSMetrics.ts` hook

### Price Tracking (`/inventory/price-tracking`)

- `src/pages/inventory/PriceTracking.tsx`
- Reads from `ingredient_price_history`

---

## Invoice Intelligence Module

Parses supplier invoices (PDF/image) using Claude Vision, matches line items to ingredients.

**Routes**: `/inventory/invoices/*`

**Files**:

- `src/pages/inventory/Invoices.tsx` — invoice list
- `src/pages/inventory/InvoiceUpload.tsx` — drag-drop upload → Claude parse → review → save
- `src/pages/inventory/InvoiceDetail.tsx` — invoice detail with match review
- `src/pages/inventory/Reconciliation.tsx` — invoice vs PO reconciliation
- `src/lib/services/invoiceParser.ts` — calls `/api/parse-invoice/`
- `src/lib/services/ingredientMatcher.ts` — fuzzy match extracted line items → ingredients
- `api/parse-invoice/index.ts` — Vercel function, calls Anthropic Claude claude-sonnet-4-6

**Tables**: `invoices`, `invoice_line_items`, `reconciliation_logs`, `reconciliation_line_items`

**Env required**: `ANTHROPIC_API_KEY` in Vercel

---

## Menu & Costing

### Menu Items (`/menu/items`)

- `src/pages/MenuItems.tsx` — CRUD for menu items

### Recipes (`/menu/recipes`)

- `src/pages/menu/Recipes.tsx` — recipe list
- `src/pages/menu/RecipeEditor.tsx` — build recipe BOM, view cost vs price
- Sub-recipes: recipes can reference other recipes as ingredients
- Cost cascade propagates through sub-recipe dependencies

---

## Labour / Workforce Module

### Roster (`/workforce/roster`)

- `src/pages/labour/Roster.tsx` — main roster view
- `src/stores/useRosterStore.ts` — Zustand store with real-time subscriptions
- `src/components/roster/` — DnD wrapper, shift dialogs, templates, quick-build
- `src/lib/services/labourService.ts` — all labour DB operations

**AU Compliance** (Fair Work):

- Minimum casual engagement: 3 hours
- Maximum ordinary hours: 38/week
- Penalty rates in `src/lib/utils/rosterCalculations.ts`
  - `AU_HOSPITALITY_PENALTY_RATES` object
  - Casual Saturday: 1.25x
  - Casual Sunday: 1.50x
  - Public Holidays: 2.25x (casual)

### Timesheets (`/workforce/timesheets`)

- `src/pages/labour/Timesheets.tsx` — list with approve/reject
- `src/pages/labour/TimesheetDetail.tsx` — per-staff detail
- `src/pages/labour/TimesheetsDaily.tsx` — daily snapshot
- `src/lib/services/timesheetService.ts` — approve/reject/adjust/generate DB ops

### Staff (`/workforce/people`)

- `src/pages/People.tsx` — staff list
- `src/pages/labour/StaffDetail.tsx` — individual staff profile

### Qualifications (`/workforce/qualifications`)

- `src/pages/labour/Qualifications.tsx`
- Expired qualifications trigger soft-block warning in `RosterDndWrapper.tsx`

### Payroll Export (`/workforce/payroll-export`)

- `src/pages/labour/PayrollExport.tsx`
- Generates CSV for payroll software (MYOB/Xero payroll)
- **AU**: Includes super guarantee amounts (11.5%), penalty rates applied

---

## Operations

### Daybook (`/operations/daybook`)

- Manager notes, daily observations
- `src/pages/operations/Daybook.tsx`

### Compliance (`/operations/compliance`)

- FSANZ food safety log
- Temperature records
- `src/pages/operations/Compliance.tsx`

---

## Admin

### Integrations (`/admin/integrations`)

- `src/pages/admin/Integrations.tsx` — Square POS + Xero cards
- `src/pages/admin/XeroSettings.tsx` — Xero account mapping (embedded)
- `src/pages/admin/XeroAccountMappings.tsx` — standalone route for same

### Data Imports (`/admin/data-imports`)

- `src/pages/admin/DataImports.tsx`
- CSV import for ingredients, staff, menu items

### Settings

- `src/pages/admin/OrgSettings.tsx` — org-level settings
- `src/pages/admin/VenueSettings.tsx` — venue-level settings (GST, penalty config)
- `src/pages/admin/Locations.tsx` — venue + location management
- `src/pages/admin/AccessRoles.tsx` — user role management

---

## Cross-Module Connections

```
Ingredient price change
  → costCascade (recipes recalculated)
  → ingredient_price_history (logged)
  → purchaseOrders (PO items updated on receive)

Staff qualifications
  → Roster (DnD warns if expired)
  → Timesheets (qualification check on shift approval)

Orders (Square sync)
  → Dashboard (sales KPIs)
  → FoodCostAnalysis (COGS denominator)
  → useDemandForecast (staffing suggestions)

Invoices (uploaded)
  → Reconciliation (vs purchase orders)
  → Ingredients (price updates if price changed)
```

---

## GST / AU Tax Notes

- GST rate: 10% (AU)
- `venue_settings.gst_inclusive` determines whether menu prices include GST
- COGS formula is GST-exclusive
- BAS: quarterly. `tax_amount` tracked on all `orders` rows
- Xero sync maps `gst_collected` and `gst_paid` to separate Xero accounts (820 by default)
