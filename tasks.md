# SuperSolt — Production Build Roadmap

**Last Updated:** 2026-02-09 (Post-Audit)
**Builder:** Donny (solo, Cursor + Claude Code)
**Standard:** Production-ready. Every module competes with the best in its category.

---

## Audit Summary — What You Actually Have

**✅ GENUINELY PRODUCTION-READY (don't touch these):**
- Auth flow (real Supabase, signup creates org/venue/membership chain)
- Ingredients CRUD (full Supabase persistence)
- Suppliers CRUD (full Supabase persistence)
- Purchase Orders (full lifecycle: draft → submitted → delivered)
- Stock Counts (full persistence with variance tracking)
- Waste Logs (full persistence)
- Menu Items (full persistence)
- Venue Settings (direct Supabase with audit trail)
- Access & Roles v2 (full RBAC with role_definitions, invites, per-venue assignments)
- Inventory Locations (full CRUD — locations, bins, assignments, count schedules)
- Order Guide (auto-generates POs from below-par ingredients)
- Import System (Excel/CSV with Zod validation, column mapping, preview)
- Labour Service (labourService.ts has full Supabase CRUD for shifts, timesheets, templates, availability, swaps, budgets)

**🔧 WORKING BUT BROKEN DATA FLOW (reads from Zustand instead of Supabase):**
- Dashboard — metrics computed from local state, not DB
- People page — manual staff add is local-only (import works)
- Recipes/RecipeEditor — NO Supabase persistence despite tables existing in DB
- OrgSettings — hardcoded defaults, not saved to DB
- Payroll — computes from local state
- Labour Reports — computes from local state

**🔴 STRUCTURAL ISSUES:**
- 22+ tables missing from types.ts (entire labour system has no generated types)
- RLS policies are "allow all" on most tables (no real security)
- Two parallel RBAC systems (org_members vs members+role_definitions)
- Duplicate Zustand store (src/lib/data/store.ts)
- Invoice intake is entirely mock

**⬜ STUB PAGES:**
- Compliance, Daybook, Operations/Imports, Integrations — all "Coming soon"

---

## How to Use This File

1. Save to your project root as `tasks.md`
2. Open Cursor → terminal → `claude`
3. Say: **"Read tasks.md. Start with Task 1. Follow the prompt exactly."**
4. When done, mark ✅, type `/exit`, start new session for next task
5. Tasks are in dependency order — do them in sequence

---

## PHASE 1: FIX THE FOUNDATION (3-4 days)

These tasks fix structural issues that affect everything else. No new features — just making what exists actually solid.

---

### Task 1: Regenerate Supabase Types & Clean Up Stores
**Status:** TODO
**Time:** ~2 hours
**Why:** 22+ tables have no TypeScript types. labourService.ts uses manual type definitions. This causes silent bugs and blocks every other task.

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 1.

## 1. REGENERATE SUPABASE TYPES

The current src/integrations/supabase/types.ts only covers 30 of 53+ tables. The entire labour system (staff, roster_shifts, timesheets, shift_templates, shift_swap_requests, staff_availability, leave_requests, labor_budgets, roster_warnings), plus recipes, recipe_ingredients, menu_sections, sales_transactions, pos_connections, daybook_entries, compliance_checks, and the RBAC v2 tables (members, role_definitions, assignments, invites, pins, access_audit) are ALL missing.

Do this:
1. Read ALL migration files in supabase/migrations/ in chronological order
2. Build a complete type definition that covers EVERY table, including:
   - All column types (use the SQL types to determine TS types)
   - Row, Insert, and Update types for each table
   - All enums (app_role, invite_status, member_status, etc.)
3. Replace src/integrations/supabase/types.ts with the complete version
4. Keep the existing Database interface structure that the Supabase client expects

After updating types.ts:
5. Read src/lib/services/labourService.ts — remove any manual type definitions that are now covered by the generated types. Update all queries to use the generated types.
6. Check src/lib/store/dataStore.ts — update any manual type interfaces to reference the generated types where possible.

## 2. REMOVE DUPLICATE STORE

Read src/lib/data/store.ts:
- This is a second Zustand store with overlapping data
- Search the entire codebase for imports from this file
- If nothing imports it: delete it
- If something does import it: migrate those imports to use src/lib/store/dataStore.ts instead, then delete it

## 3. CLEAN UP ORPHAN PAGES

- src/pages/inventory/Purchases.tsx — has no route, replaced by PurchaseOrders
- src/pages/inventory/Counts.tsx — has no route, replaced by StockCounts
- Check if anything imports these files. If not, delete them.

## 4. FIX DIAGNOSTICS

Read src/stores/useDiagnosticsStore.ts:
- All checks have passIf: () => true (always pass)
- Either implement real checks or remove the diagnostics feature entirely
- If keeping: checks should verify things like "Supabase connected", "at least 1 venue exists", "types.ts is up to date"

Run npm run build after all changes. Fix any type errors that surface.
```

---

### Task 2: Fix RLS Policies — Real Security
**Status:** TODO
**Time:** ~3 hours
**Why:** Most tables have "allow all" RLS policies. Any authenticated user can read/write ANY org's data. This is a data breach waiting to happen.

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 2 — fix Row Level Security.

## THE PROBLEM

The audit found that early migrations (1-5) have proper org-based RLS using get_user_org_ids() and is_org_admin() helper functions. But later migrations (6-20) use "Allow all" placeholder policies on most tables.

Tables with BROKEN/MISSING RLS (any authenticated user can access any org's data):
- orders
- suppliers
- ingredients
- purchase_orders, purchase_order_items
- stock_counts, stock_count_items
- waste_logs
- menu_items
- venue_settings, venue_settings_audit
- inv_locations, inv_bins, inv_location_assignments, device_assignments, count_schedules
- members, role_definitions, assignments, invites, pins, access_audit
- staff, roster_shifts, timesheets, shift_templates, shift_swap_requests, staff_availability, leave_requests, labor_budgets, roster_warnings
- onboarding_invites, staff_documents
- recipes, recipe_ingredients, menu_sections
- sales_transactions, sales_transaction_items, pos_connections
- daybook_entries, compliance_checks
- chart_of_accounts

## WHAT TO DO

Create a new migration file (use the timestamp format: YYYYMMDDHHMMSS_fix_rls_policies.sql).

The RLS pattern should be:
1. Every table needs RLS enabled (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
2. Every table needs policies for SELECT, INSERT, UPDATE, DELETE

The access chain is: auth.uid() → profiles → org_members → organizations → venues → [data table]

For tables with organisation_id or org_id column:
```sql
CREATE POLICY "Users can view own org data" ON table_name
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert own org data" ON table_name
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
-- Similar for UPDATE and DELETE
```

For tables with venue_id column (but no org_id):
```sql
CREATE POLICY "Users can view own venue data" ON table_name
  FOR SELECT USING (
    venue_id IN (
      SELECT v.id FROM venues v
      JOIN org_members om ON om.org_id = v.org_id
      WHERE om.user_id = auth.uid()
    )
  );
```

For tables linked through other tables (like purchase_order_items → purchase_orders → venue):
```sql
CREATE POLICY "Users can view own PO items" ON purchase_order_items
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT po.id FROM purchase_orders po
      JOIN venues v ON v.id = po.venue_id
      JOIN org_members om ON om.org_id = v.org_id
      WHERE om.user_id = auth.uid()
    )
  );
```

First: DROP all existing "Allow all" / placeholder policies.
Then: Create proper org-scoped policies for EVERY table.

Check if the existing helper functions get_user_org_ids() and is_org_admin() from early migrations still exist. If so, use them for consistency.

Also handle: the profiles table should let users read/update their own profile only (WHERE id = auth.uid()).

Write the complete migration SQL. Don't skip any table.

After creating the migration file in supabase/migrations/:
Run npm run build to ensure no TypeScript errors.
```

---

### Task 3: Wire Recipes to Supabase
**Status:** TODO
**Time:** ~3 hours
**Why:** Recipes are the #1 broken module — tables exist in the DB but the app stores everything in localStorage. Recipe data vanishes when you clear your browser. This directly blocks COGS calculations and menu pricing.

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 3 — wire Recipes to Supabase.

## THE PROBLEM

The database has recipes, recipe_ingredients, and menu_sections tables (created in migrations). But:
- src/pages/menu/Recipes.tsx reads from Zustand local state only
- src/pages/menu/RecipeEditor.tsx saves to Zustand only — no Supabase calls
- Recipe data is lost on localStorage clear

The types for these tables were just added in Task 1, so they should now be available.

## WHAT TO DO

### 1. Recipes List Page (src/pages/menu/Recipes.tsx)

Read the current implementation, then update:
- Load recipes from Supabase on mount: supabase.from('recipes').select('*, recipe_ingredients(*, ingredients(*))').eq('org_id', currentOrg.id)
- Use React Query (useQuery) for the fetch — pattern already used elsewhere in the app
- Show loading skeleton while fetching
- Show EmptyState when no recipes: "No recipes yet. Create your first recipe to start tracking food costs."
- Keep the existing UI layout — only change the data source

### 2. Recipe Editor (src/pages/menu/RecipeEditor.tsx)

This is the critical fix. Read the current editor, then update:

SAVE must go to Supabase:
- When creating a new recipe:
  1. Insert into recipes table (name, category, org_id, venue_id, yield_qty, yield_unit, method_steps, allergens)
  2. For each ingredient line: insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
  3. Return the new recipe_id
  
- When updating an existing recipe:
  1. Update the recipes row
  2. Delete all existing recipe_ingredients for this recipe_id
  3. Re-insert the current ingredient lines
  (This is simpler than diffing — just replace all lines on every save)

- When deleting a recipe:
  1. Delete recipe_ingredients where recipe_id = X
  2. Delete recipe where id = X

COST CALCULATIONS must use real ingredient costs from Supabase:
- Each recipe_ingredient line should compute: line_cost = ingredient.cost_per_unit × quantity × unit_conversion_factor
- Total recipe cost = sum of all line costs
- Cost per serve = total_cost / yield_qty
- If linked to a menu_item: GP% = ((selling_price - cost_per_serve) / selling_price) × 100

Show toast on save success/failure.
Invalidate the recipes query cache after any mutation.

### 3. Sub-Recipe Support

Check if the current recipe_ingredients table has a sub_recipe_id column (for recipes within recipes, like a sauce used in a main dish).
- If not: add it to the schema (create migration). Allow recipe_ingredients to reference either an ingredient_id OR a sub_recipe_id (one must be null).
- In the editor: allow adding a recipe as an ingredient. Its cost = the sub-recipe's cost_per_serve.

### 4. Recipe Versioning (basic)

Add a recipe_versions table if it doesn't exist:
- id, recipe_id, version_number, snapshot_json (full recipe + ingredients as JSON), changed_by, created_at
- On every save, before updating the recipe, snapshot the current state into recipe_versions
- Show version history in the editor (read-only list of past versions)

### 5. Menu Item Linking

Verify that menu_items can reference a recipe_id. When viewing a menu item:
- Show the linked recipe's cost per serve
- Show GP%
- If recipe cost changes (ingredient price update), menu item GP% must reflect the change

### 6. Update the Zustand Store

After wiring to Supabase:
- The dataStore should still cache recipes for quick access (optimistic UI)
- But the source of truth is Supabase
- On app load: fetch recipes from Supabase → populate Zustand store
- On save: write to Supabase first, then update Zustand on success

Run npm run build after all changes.
```

---

### Task 4: Wire Dashboard to Real Data
**Status:** TODO
**Time:** ~3 hours
**Why:** The dashboard currently computes all metrics from Zustand local state. If you haven't imported data in this browser session, you see nothing. It needs to pull from Supabase directly.

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 4 — wire Dashboard metrics to Supabase.

## THE PROBLEM

The audit found that Dashboard reads from Zustand metric hooks which compute from local state (orders, staff, timesheets loaded into memory). The data IS in Supabase (orders, roster_shifts, waste_logs, etc.) but the dashboard doesn't query it directly.

## WHAT TO DO

### 1. Update Sales Metrics Hook (src/lib/hooks/useSalesMetrics.ts)

Read the current implementation, then change the data source:
- Query orders table directly from Supabase, filtered by venue_id and date range
- Use React Query with the date range as the query key (so it refetches when dates change)
- Calculate:
  - Total revenue (sum of net_amount, exclude voids/refunds if flagged)
  - Order count
  - Average check (revenue / order_count)
  - Channel breakdown: group by channel, sum revenue per channel, calculate percentages
  - Comparison: vs yesterday, vs same day last week (requires 2 additional queries)
  - Hourly breakdown: group by hour of order_datetime
- All monetary values: stored as cents in DB, display as dollars with 2dp
- GST calculation: GST = gross_amount - net_amount (already separated in orders table)

### 2. Update Labour Metrics Hook (src/lib/hooks/useLabourMetrics.ts)

- Query roster_shifts from Supabase, filtered by venue_id and date range
- Calculate:
  - Total scheduled hours (sum of shift durations minus breaks)
  - Total labour cost (sum of base_cost + penalty_cost from roster_shifts)
  - Labour % = (total_labour_cost / total_revenue) × 100
  - Breakdown by role/area
- Use the existing labourService.ts for queries where appropriate

### 3. Update COGS Metrics Hook (src/lib/hooks/useCOGSMetrics.ts)

- Theoretical COGS: for each order, look up items sold → menu_item → recipe → cost_per_serve × qty
  - This requires item-level sales data. If orders table only has totals (not line items), note this as a limitation and use the sales_transaction_items table if it has data
  - If no item-level data available: show "Import item-level sales data for COGS tracking" message
- Waste impact: sum of waste_logs.value for the date range
- GP% = ((revenue - theoretical_cogs) / revenue) × 100

### 4. Update Inventory Metrics Hook (src/lib/hooks/useInventoryMetrics.ts)

- Low stock count: ingredients WHERE current_stock < par_level
- Total inventory value: sum of (current_stock × cost_per_unit) for all ingredients
- Pending POs: count of purchase_orders WHERE status = 'submitted'

### 5. Update Roster Metrics Hook (src/lib/hooks/useRosterMetrics.ts)

- Today's shifts: roster_shifts WHERE date = today AND venue_id = X
- Staff on duty: count of active shifts
- Gaps: any unfilled required positions

### 6. Dashboard Page (src/pages/Dashboard.tsx)

- Make sure DateRangeSelector controls the date range passed to all hooks
- Add venue selector if user has multiple venues (from AuthContext)
- All metric cards should show:
  - Current value
  - Comparison (vs previous period)
  - Trend direction (up/down arrow with green/red color)
- Charts should use recharts (already installed)
- When no data: show helpful empty states with action buttons ("Import Sales Data", "Create First Roster", etc.)

### 7. Data Loading Pattern

The hooks should follow this pattern:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['salesMetrics', venueId, startDate, endDate],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('venue_id', venueId)
      .gte('order_datetime', startDate)
      .lte('order_datetime', endDate);
    if (error) throw error;
    return data;
  },
  enabled: !!venueId,
});
```

Run npm run build after all changes.
```

---

### Task 5: Fix Remaining Data Flow Gaps
**Status:** TODO
**Time:** ~3 hours
**Why:** Several pages have partial persistence. This task catches everything the module-specific tasks don't cover.

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 5 — fix all remaining data flow gaps.

## 1. PEOPLE PAGE — Staff Manual Add (src/pages/People.tsx)

The audit found that adding staff via the dialog only updates Zustand. The importStaff() bulk import DOES write to Supabase, but individual add/edit does not.

Fix:
- When adding a new staff member via StaffDialog/StaffForm:
  1. Insert into staff table (org_id, venue_id, first_name, last_name, email, phone, position, hourly_rate, employment_type, status)
  2. On success: update Zustand store AND show success toast
  3. On error: show error toast, don't update Zustand
- When editing a staff member: update the staff row in Supabase
- When deactivating: update status to 'inactive' in Supabase
- Staff list should load from Supabase on mount (like ingredients do)

## 2. ORG SETTINGS (src/pages/admin/OrgSettings.tsx)

The audit found orgSettings is hardcoded with initializeOrgDefaults(). Not saved to DB.

Fix:
- Check if an organizations or org_settings table exists with config fields
- If organizations table has config columns: load from there, save to there
- If not: create a migration adding org_settings fields to organizations table (or create a separate org_settings table):
  - financial_year_start (default 7 for July in AU)
  - default_currency (default 'AUD')
  - week_starts_on (default 'monday')
  - Any other settings currently hardcoded in initializeOrgDefaults()
- Update OrgSettings page to load from Supabase and save to Supabase
- Show toast on save

## 3. PAYROLL PAGE (src/pages/Payroll.tsx)

The audit found this computes entirely from local state.

Fix:
- Load approved timesheets from Supabase: timesheets WHERE status = 'approved' AND venue_id = X AND date range
- Load staff details for each timesheet
- The computation logic (pay rates, penalties, super) can stay client-side — just make sure the INPUT data comes from Supabase
- CSV export can remain client-side (generates file from the computed data)

## 4. LABOUR REPORTS (src/pages/labour/Reports.tsx)

Same issue — computes from local state.

Fix:
- Load roster_shifts, timesheets, and orders from Supabase for the selected date range
- Compute metrics from the fetched data
- Use React Query for the fetches

## 5. INVOICE INTAKE (Mock → Real)

The audit found useInvoiceIntakeStore.ts uses simulated OCR with hardcoded demo data.

For MVP, replace the mock with real manual entry:
- Remove the fake OCR simulation
- Invoice upload: store the file in Supabase storage (PDF/image)
- Manual line-item entry: supplier, invoice number, date, line items (ingredient, qty, price)
- Save to the invoices and invoice_lines tables (create these if they don't exist — check migrations)
- Match to PO if applicable
- Invoice approval workflow: draft → pending → approved

## 6. UNIFIED RBAC

The audit found two parallel systems: org_members.role AND members+role_definitions+assignments.

Decision: Keep the v2 system (members + role_definitions + assignments) as it's more flexible.
- Update AuthContext.tsx to load the user's role from the v2 system (assignments → role_definitions)
- Fall back to org_members.role if no v2 assignment exists (for existing users)
- ProtectedRoute should check permissions from role_definitions.permissions JSON
- Eventually deprecate org_members.role, but don't break existing data

Run npm run build after all changes.
```

---

## PHASE 2: PRODUCTION-QUALITY MODULES (14-18 days)

Phase 1 fixed the plumbing. Now build each module to compete with the best standalone tool. Each task below should be a self-contained Claude Code session.

---

### Task 6: Sales & Dashboard — Square/Lightspeed Quality
**Status:** TODO
**Dependencies:** Tasks 1-5
**Time:** ~2-3 days
**Benchmark:** Square Dashboard, Lightspeed Analytics

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 6 — make the Sales Dashboard production-quality.

The data flow was fixed in Task 4. Now build the UI and analytics to match Square Dashboard quality.

## DASHBOARD LAYOUT (src/pages/Dashboard.tsx)

### Top Bar
- Venue selector (if multi-venue)
- Date range selector (Today, Yesterday, This Week, Last Week, This Month, Last Month, Custom)
- Last sync indicator: "Data current as of [timestamp]" or "Last import: [date]"

### KPI Row (4 cards across)
Each card shows: metric name, current value, comparison vs previous period (↑12% or ↓5%), sparkline mini-chart

1. Net Revenue — today's total, vs yesterday, with 7-day sparkline
2. Average Check — net / orders, vs yesterday
3. Labour % — labour cost / revenue × 100, color-coded (green <28%, amber 28-32%, red >32%)
4. GP% — (revenue - COGS) / revenue × 100, color-coded (green >65%, amber 55-65%, red <55%)

### Row 2: Sales Charts (2 columns)
Left: Revenue trend (last 7/14/30 days, line chart, with comparison to previous period as dotted line)
Right: Channel breakdown (donut chart — dine-in, takeaway, delivery with $ and % labels)

### Row 3: Operations (3 columns)
Left: Hourly sales today (bar chart, shows revenue per hour, highlights peak periods)
Middle: Roster today (mini roster view — who's on, gaps, total cost)
Right: Alerts panel:
- Items below GP target
- Low stock items (below par)
- Pending timesheet approvals
- Expiring staff documents
- Overdue POs

### Row 4: Quick Actions
- Import Sales Data → navigates to Data Imports
- Create Roster → navigates to Roster
- Start Stock Count → navigates to New Stock Count
- Log Waste → navigates to Waste

## SALES DETAIL PAGE

If you don't have a separate sales page, create src/pages/Sales.tsx:
- Transaction list: date/time, order number, channel, gross, tax, net, payment method
- Filterable by: date range, channel, payment method
- Sortable by any column
- Search by order number
- Summary stats at top: total orders, total revenue, avg check
- Export to CSV

## IMPORT IMPROVEMENTS

The existing ImportWizard works. Enhance it:
- After import, show a summary dashboard: "Imported 1,247 orders from Jan 1 - Jan 31"
  - Revenue by day chart
  - Channel breakdown
  - Any parsing warnings
- Store import history: date, file name, record count, imported_by (use admin_data_jobs table or import_history if it exists)

## CHARTS

Use recharts (already installed). Every chart must:
- Have proper axis labels
- Show tooltips on hover with formatted values ($1,234.56)
- Use your brand colors consistently
- Handle zero/no data gracefully (show "No data for this period")
- Be responsive (resize with container)

Run npm run build after all changes.
```

---

### Task 7: Recipe Costing — MarketMan/Apicbase Quality
**Status:** TODO
**Dependencies:** Task 3 (recipes wired to Supabase)
**Time:** ~2-3 days
**Benchmark:** MarketMan, Apicbase, Cooking the Books

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 7 — make Recipe Costing production-quality.

Task 3 wired recipes to Supabase. Now build the full costing engine and UI.

## INGREDIENT MASTER ENHANCEMENTS (src/pages/Ingredients.tsx)

The ingredient CRUD already works. Enhance:

1. Cost tracking:
   - Show cost per unit prominently (e.g., "$4.50/kg")
   - Show pack info: "10kg carton @ $45.00"
   - Waste factor: if ingredient has 15% trim waste, show effective cost = cost / (1 - waste%) = $5.29/kg
   - Price trend: small sparkline showing cost changes over time (need to track price history)

2. Create ingredient_price_history table (migration) if it doesn't exist:
   - id, ingredient_id, old_cost_cents, new_cost_cents, changed_at, changed_by, source (manual/invoice)
   - Every time cost_per_unit is updated, log the change

3. Ingredient categories should be consistent: Produce, Protein, Dairy, Dry Goods, Beverages, Packaging, Cleaning, Other

4. Bulk import: the import system already handles ingredients. Verify columns: name, category, unit, cost_per_unit (dollars), pack_size, supplier name.

## RECIPE EDITOR — Production Quality (src/pages/menu/RecipeEditor.tsx)

1. Layout: Two-column editor
   - Left: Recipe details (name, category, method, photo, yield)
   - Right: Ingredient lines with live costing

2. Ingredient line features:
   - Search-as-you-type ingredient selector
   - Quantity input with UOM selector (must match ingredient's base UOM or convert)
   - Live line cost as you type: quantity × cost_per_unit × conversion
   - Reorder lines (drag-and-drop or up/down arrows)
   - Delete line (with confirm)

3. Sub-recipes:
   - Allow adding another recipe as an ingredient line
   - Its cost = that recipe's cost_per_serve
   - Show a visual indicator that this line is a sub-recipe (different icon/color)
   - Prevent circular references (recipe A can't contain recipe B if recipe B contains recipe A)

4. Costing panel (always visible on the right):
   - Total ingredient cost (sum of all lines)
   - + Waste factor cost (total × average waste %)
   - = Total batch cost
   - ÷ Yield (serves per batch)
   - = Cost per serve
   - Linked sell price (from menu_item if linked)
   - GP% = (sell_price_ex_gst - cost_per_serve) / sell_price_ex_gst × 100
   - Show GST handling: sell price is typically GST-inclusive in AU, so ex-GST = price / 1.1

5. All monetary calculations:
   - Store as integer cents in database
   - Calculate in cents (avoid floating point for money)
   - Convert to dollars only for display (cents / 100, toFixed(2))
   - Unit conversion must be exact: 500g of a $4.50/kg ingredient = 0.5 × 450 cents = 225 cents

6. Allergen tracking:
   - Checkboxes: Gluten, Dairy, Nuts, Eggs, Soy, Fish, Shellfish, Sesame, Lupin
   - Auto-inherit from ingredients (if ingredient is flagged as containing nuts, any recipe using it inherits)

7. Recipe card view:
   - Printable recipe card format (for kitchen use)
   - Shows: ingredients list with quantities, method steps, allergens, yield info
   - This can be a print-optimized view of the editor

## MENU ITEMS ENHANCEMENTS (src/pages/MenuItems.tsx)

Menu items already have Supabase persistence. Enhance:

1. Table view with columns:
   - Name, Category, Sell Price (inc GST), Cost Per Serve, GP%, Status
   - GP% color-coded: green ≥65%, amber 50-65%, red <50%
   - Click row to edit

2. GP% alerts:
   - When any ingredient cost changes, recalculate all affected recipes
   - On the menu items page, show a banner: "3 items below target GP — review pricing"
   - Highlight affected rows in red

3. Menu analysis:
   - Average GP% across all items
   - Revenue-weighted GP% (items that sell more have more impact)
   - Category breakdown (food GP% vs beverage GP%)
   - Stars/plowhorses/dogs matrix (high margin + high sales = star) — optional

## COST CHANGE CASCADE

This is critical for a real costing tool:
1. When ingredient price changes (manual edit or invoice processing):
   - Update ingredient.cost_per_unit
   - Log to ingredient_price_history
   - Find all recipe_ingredients that use this ingredient
   - Recalculate each recipe's total cost and cost_per_serve
   - Update each linked menu_item's GP%
   - If any menu item GP% drops below venue target (from venue_settings.gp_target_percent): flag it

Build this as a utility function that can be called from:
- Ingredient edit form
- Invoice approval (when accepting a new price)
- Bulk price update import

Run npm run build after all changes.
```

---

### Task 8: Inventory & Purchasing — MarketMan Quality
**Status:** TODO
**Dependencies:** Task 7 (needs ingredients)
**Time:** ~2-3 days
**Benchmark:** MarketMan, Lightspeed Inventory

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 8 — make Inventory & Purchasing production-quality.

Good news: Stock Counts, Waste Logs, POs, Order Guide all have Supabase persistence. Enhance the UI and add missing features.

## STOCK COUNTS (already working — enhance)

src/pages/inventory/StockCounts.tsx and NewStockCount.tsx:

1. Count list page:
   - Show: date, type (full/cycle), status (in-progress/completed), counted by, total value, variance $
   - Filter by status, date range

2. New count enhancements:
   - Group items by storage location (cool room items together, dry store together)
   - Show last count qty and theoretical current qty (opening + received - sold - wasted)
   - Highlight significant variances (>10%) in red as they're entered
   - Allow saving as draft (come back later to finish)
   - On complete: update ingredient.current_stock with counted quantities

3. Variance reporting:
   - After count is completed, show variance summary
   - Variance = actual counted - theoretical
   - Theoretical = last count + received (from POs) - theoretical usage (from POS sales × recipes) - logged waste
   - Highlight top 5 variance items
   - Require manager note for large variances

## WASTE LOG (already working — enhance)

src/pages/inventory/Waste.tsx:

1. Waste entry enhancements:
   - Quick-add: most commonly wasted items at the top
   - Reason codes: Spoilage, Expired, Overproduction, Dropped/Breakage, Staff Meal, Promo/Comp, Theft/Unknown
   - Photo upload (store in Supabase storage)
   - Auto-calculate dollar value from ingredient cost × quantity

2. Waste dashboard:
   - Add a summary section at the top:
     - Total waste value (this week, this month)
     - Waste as % of COGS
     - Top wasted items (by value)
     - Waste by reason (bar chart)
     - Trend line (daily waste value over last 30 days)

## PURCHASE ORDERS (already working — enhance)

src/pages/inventory/PurchaseOrders.tsx and PurchaseOrderDetail.tsx:

1. PO list enhancements:
   - Show: PO#, supplier, date, expected delivery, status, total
   - Filter by status, supplier, date range
   - Badge counts: X pending, Y overdue

2. PO creation enhancements:
   - When adding items: show current stock, par level, and suggested order qty
   - Suggested = par_level - current_stock (if positive)
   - Show supplier's minimum order value (from suppliers table)
   - Show delivery lead time

3. Receiving enhancements:
   - Side-by-side: ordered qty vs received qty for each line
   - Log price variances (PO price vs actual invoice price)
   - Option to update ingredient cost when receiving at a new price
   - On receive: update ingredient.current_stock += received_qty (convert UOM if needed)

4. PO to PDF:
   - Generate a printable PO (for emailing to suppliers)
   - Include: your venue details, supplier details, items, quantities, unit costs, total
   - This can be a print-optimized page view

## ORDER GUIDE (already working — enhance)

src/pages/inventory/OrderGuide.tsx:

1. Already auto-generates POs from below-par items. Enhance:
   - Show usage rate (average daily usage from last 2 weeks of sales + recipes)
   - Days of stock remaining = current_stock / daily_usage
   - Color code: red (<2 days), amber (2-4 days), green (>4 days)
   - "Generate All Orders" groups items by supplier and creates one PO per supplier

## STOCK TRANSFERS (new if not exists)

If venues will eventually have inter-site transfers:
- Create src/pages/inventory/Transfers.tsx
- Transfer out: select items and quantities, select destination venue
- Transfer in: receive transfer, confirm quantities
- Updates stock at both venues
- For MVP: might be overkill if only one venue — mark as Phase 2 if so

## INVENTORY REPORTS

Add reporting to an existing page or create src/pages/inventory/Reports.tsx:
- Stock on Hand: all items with current qty and value
- Stock Movement: for a date range — opening, received, used, wasted, closing
- Category summary: total value by category (produce, protein, etc.)
- Export all to CSV

Run npm run build after all changes.
```

---

### Task 9: Labour & Rostering — Tanda Quality
**Status:** TODO
**Dependencies:** Task 5 (staff data flow fixed)
**Time:** ~3-4 days
**Benchmark:** Tanda, Deputy

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 9 — make Labour & Rostering Tanda-quality.

Good news: labourService.ts already has full Supabase CRUD for shifts, timesheets, templates, availability, swaps, budgets. The roster UI has shift creation with AU penalty rates and conflict detection. Build on this foundation.

## ROSTER VIEWS (src/pages/labour/Roster.tsx + components)

Read the existing 7 roster components. Enhance to Tanda quality:

### Week View (primary view — this is what managers live in)
- Grid: rows = staff, columns = Mon-Sun
- Each cell shows shift block(s) with: time range, role/area, cost
- Color coding by role: Kitchen (blue), FOH (green), Bar (purple), Management (gray)
- Bottom row: daily totals (hours, cost, staff count)
- Right column: weekly totals per staff member
- Top summary: total weekly cost, labour %, vs budget

### Shift Creation/Editing
- Click empty cell → create shift dialog
- Click existing shift → edit shift dialog
- ShiftDialog.tsx already has:
  - Start/end time pickers
  - Break duration
  - Role/area selector
  - Real-time cost calculation with AU penalty rates
  - Shift conflict detection
- Verify these all work correctly. Add if missing:
  - Drag to move shift (to different staff or different day)
  - Copy shift (to same or different day)
  - Delete shift (with confirmation)
  - Repeat shift (apply same shift for next X weeks)

### Copy & Template Features
- Copy day: duplicate all shifts from one day to another
- Copy week: duplicate entire week to next week
- Save as template: save current week layout as a named template
- Load template: apply a template to current week (warns about conflicts)
- Templates stored in shift_templates table (already exists)

### Publish Workflow
- Draft → Published
- While draft: shifts are editable, staff can't see them
- On publish: mark all shifts as published, trigger notifications (for Phase 2 mobile, just set the status for now)
- Changes to published shifts: require confirmation, log the change

## AU PENALTY RATE ENGINE

Read src/lib/utils/labourCalculations.ts. Verify/build the full Hospitality Industry General Award 2020 rates:

Base rates are per employment type and classification — for MVP, the user sets the base rate on the staff record.

Penalty multipliers (applied to base rate):
- Monday to Friday: 1.0× (ordinary time)
- Saturday: 1.25× (permanent), 1.0× for casuals (already have 25% loading)
- Sunday: 1.50× (permanent), 1.0× for casuals (casual loading covers it — actually check this, Sunday is 1.75× for casuals under the current award)
- Public Holiday: 2.50× (permanent), 2.75× for casuals
- Evening (after 7pm weekdays): 1.15× (15% loading)
- Overtime (full-time beyond 38hrs/week, or beyond 10hrs/day):
  - First 2 hours: 1.50×
  - After 2 hours: 2.00×
- Casual loading: 25% on top of base (this is typically built into their hourly rate already)

Break rules:
- After 5 continuous hours: 30-minute unpaid meal break required
- After 4 hours: 10-minute paid rest break
- Log break warnings if shifts violate these rules

Minimum engagement:
- Casual employees: minimum 3-hour shift
- Part-time employees: minimum 3-hour shift
- Warn if a shift is shorter than minimum

For each shift, the cost calculation should return:
```typescript
{
  base_hours: number,
  base_cost_cents: number,
  penalty_type: string | null, // 'saturday', 'sunday', 'public_holiday', 'evening', 'overtime'
  penalty_multiplier: number,
  penalty_cost_cents: number,
  break_deduction_minutes: number,
  total_cost_cents: number
}
```

Store this breakdown in the roster_shifts table (base_cost and penalty_cost columns exist).

## PUBLIC HOLIDAYS

Check if public_holidays table exists. If not, create it:
- id, date, name, state, is_national

Populate with 2025 and 2026 Australian public holidays:
National: New Year's Day, Australia Day (Jan 26), Good Friday, Saturday before Easter, Easter Monday, Anzac Day (Apr 25), Queen's Birthday, Christmas Day, Boxing Day
Victoria-specific: Melbourne Cup Day (first Tuesday in November), AFL Grand Final Friday

The penalty rate engine must check if a shift date falls on a public holiday.

## TIMESHEETS (src/pages/labour/Timesheets.tsx)

1. Timesheet list:
   - Show by pay period (weekly or fortnightly — from venue_settings)
   - Each staff member has one timesheet per period
   - Columns: staff name, total hours, ordinary hours, penalty hours, total cost, status
   - Status: draft, submitted, approved, exported

2. Timesheet detail:
   - List of shifts for the period with: date, rostered start/end, actual start/end, breaks, hours, cost
   - Manager can adjust actual times (with reason code dropdown: late start, early finish, extended, no-show, other)
   - Adjustments logged (who changed what, when)

3. Approval flow:
   - Manager reviews and approves (or rejects with note)
   - Bulk approve option (approve all pending)
   - Once approved, can't be edited without un-approving first

## PAYROLL EXPORT (src/pages/Payroll.tsx)

1. Show approved timesheets for the current pay period
2. For each staff member, compute:
   - Ordinary hours and earnings
   - Each penalty type as a separate line (Saturday loading, Sunday loading, etc.)
   - Total gross pay
   - Super contribution: 11.5% of Ordinary Time Earnings (OTE) — current AU rate
3. Export as CSV in Xero/KeyPay/MYOB format (selectable)
4. Mark timesheets as "exported" after export

## LABOUR REPORTS (src/pages/labour/Reports.tsx)

1. Reports must query Supabase directly (fixed in Task 5)
2. Available reports:
   - Labour hours by period (daily, weekly, monthly)
   - Labour cost by period
   - Labour % (cost / revenue)
   - Hours and cost by role/department
   - Overtime report
   - Rostered vs actual comparison
   - Staff utilization (hours worked / hours available)
3. All reports exportable to CSV

## AVAILABILITY & LEAVE

1. Staff availability (src/components/AvailabilityDialog.tsx):
   - Already has weekly pattern (day, start_time, end_time, is_available)
   - On roster view: when creating a shift, check if staff member is available
   - If not available: show warning, allow override with confirmation

2. Leave requests:
   - Staff submits: leave type (annual, personal/sick, unpaid), dates, notes
   - Manager approves/declines from People page or a dedicated Leave page
   - Approved leave blocks those dates from rostering (show as "on leave" in roster view)
   - Leave balances: track accrued vs taken for permanent staff

Run npm run build after all changes.
```

---

### Task 10: Suppliers & Invoice Processing
**Status:** TODO
**Dependencies:** Task 5 (invoice intake fixed)
**Time:** ~1-2 days
**Benchmark:** MarketMan purchasing

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 10 — make Suppliers & Invoice Processing production-quality.

Suppliers already have full Supabase CRUD. Enhance and build invoice processing.

## SUPPLIER ENHANCEMENTS (src/pages/Suppliers.tsx + SupplierDetail.tsx)

1. Supplier list:
   - Columns: name, category, contact, phone, ABN, status, monthly spend
   - Monthly spend = sum of approved invoices for this supplier in current month
   - Filter by category, status
   - Search by name, ABN

2. Supplier detail page enhancements:
   - Products tab: list of ingredients supplied, with current price, last price, price change %
   - Orders tab: past POs with totals
   - Invoices tab: past invoices with payment status
   - Price History tab: chart showing price changes per product over time
   - Notes/activity log

3. Supplier form enhancements:
   - ABN validation: 11 digits, Australian Business Number format
   - GST registration checkbox
   - Delivery days: checkboxes for Mon-Sun (which days they deliver)
   - Lead time: number of days from order to delivery
   - Minimum order value (cents)
   - Order method: email, phone, online portal, rep visit

## INVOICE PROCESSING

Task 5 replaced the mock invoice intake with manual entry. Now build the full workflow:

1. Invoice entry (src/pages/admin/data-imports/InvoiceUploadDrawer.tsx):
   - Upload invoice document (PDF/image) → store in Supabase storage
   - Manual data entry form:
     - Supplier (autocomplete from suppliers)
     - Invoice number (check for duplicates per supplier)
     - Invoice date, due date
     - Line items: ingredient (autocomplete), qty, UOM, unit price, line total, GST
     - System auto-calculates: subtotal, GST total, total
   - "Match to PO" button: select from open POs for this supplier

2. PO matching:
   - If matched to PO, side-by-side comparison:
     - Each line: PO qty/price vs invoice qty/price
     - Flag variances with $ and % difference
   - Price variance: option to "Accept new price" (updates ingredient cost, triggers cascade)

3. Invoice approval (src/pages/admin/data-imports/InvoicesTab.tsx):
   - List all invoices: supplier, invoice#, date, total, status
   - Status: draft → pending_approval → approved → paid (→ exported)
   - Approve: updates COGS records, triggers cost cascades if prices changed
   - Reject: add note, notify

4. Spend tracking:
   - Total spend by supplier (for a date range)
   - Total spend by category
   - Month-over-month comparison
   - Top suppliers by spend

Run npm run build after all changes.
```

---

### Task 11: Onboarding & Compliance
**Status:** TODO
**Dependencies:** Task 9 (needs staff)
**Time:** ~2 days
**Benchmark:** Employment Hero, Tanda onboarding

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 11 — make Onboarding production-quality.

The 7 onboarding step components exist. Database tables exist (onboarding_invites, staff_documents). Build the complete flow.

## INVITE FLOW

1. Manager starts onboarding from People page:
   - Click "Invite Staff" button
   - Enter: email, first name, role (FOH/BOH/Bar/Management), employment type (full-time/part-time/casual)
   - System creates: staff record (status: 'invited'), onboarding_invite with unique token
   - Generate invite URL: /onboarding/invite/{token}
   - Copy URL button (for sending via SMS/messaging)
   - For Phase 2: send email with invite link

2. Invite portal (src/pages/onboarding/InvitePortal.tsx):
   - Staff member opens the invite URL
   - Token is validated (check expiry, not already used)
   - Progress through the 7 steps
   - Each step saves to Supabase immediately (not just on final submit)
   - Show progress bar (step 3 of 7)

3. Each step must save its data:
   - ContactDetailsStep → staff table (first_name, last_name, preferred_name, date_of_birth, email, phone)
   - AddressStep → staff table (address fields — add columns if missing)
   - TFNDeclarationStep → save TFN (encrypted) and residency status
     - TFN validation: 9 digits, use ATO check digit algorithm if possible
     - If no TFN: show warning about maximum tax withholding
   - SuperChoiceStep → super_fund_name, super_abn, super_usi, super_member_number on staff table
     - Use src/lib/data/superFunds.ts for auto-suggest common AU super funds
   - BankDetailsStep → bank_account_name, bank_bsb, bank_account_number on staff table
     - BSB validation: 6 digits, use src/lib/utils/bsbLookup.ts
   - DocumentsStep → upload files to Supabase storage, create staff_documents records
     - Document types: ID (licence/passport), RSA, Food Safety, Visa, Other
     - Expiry date field for each document
   - PoliciesStep → save acknowledgements to policy_acknowledgements table (create if not exists)
     - Fair Work Information Statement (FWIS)
     - Casual Employment Information Statement (CEIS) — only if employment_type is casual
     - WHS Policy
     - Privacy Policy
     - Each acknowledgement records: policy name, version, timestamp

4. After all steps complete:
   - Staff status changes to 'pending_approval'
   - Manager reviews from People page → Staff Detail view
   - Manager sets: award classification, hourly rate, start date
   - Manager approves → status = 'active'

## COMPLIANCE DASHBOARD (src/pages/operations/Compliance.tsx)

Replace the stub with:
1. Onboarding status overview:
   - Staff in each status: invited, in_progress, pending_approval, active
   - List of incomplete onboardings with which steps are missing

2. Document compliance:
   - Expiring documents: next 30/60/90 days
   - Expired documents (overdue)
   - Missing required documents (e.g., RSA required for bar staff)

3. Policy compliance:
   - Staff who haven't acknowledged latest policy versions
   - When policies are updated, flag staff who need to re-acknowledge

Run npm run build after all changes.
```

---

### Task 12: Admin, Daybook & Operations
**Status:** TODO
**Dependencies:** Task 5
**Time:** ~1-2 days

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 12 — build out Admin and Operations pages.

## ORG SETTINGS (fixed in Task 5 — enhance)

Add to the page:
- Logo upload (Supabase storage)
- Business ABN with validation
- Financial year start month
- Default currency display
- Payroll cycle setting (weekly/fortnightly/monthly)

## VENUE SETTINGS (already production-ready — verify)

Already has direct Supabase read/write with audit trail. Verify:
- Trading hours per day of week
- POS system type selection
- Labour budget % target
- GP% target
- GST settings
- All settings save correctly and audit trail logs changes

## DAYBOOK (src/pages/operations/Daybook.tsx)

Replace the stub:
1. Daily operations log — entries by date
2. Entry form: date, category (general, maintenance, incident, delivery, staff, cash), text content, amount (optional)
3. Save to daybook_entries table
4. List view: filter by date range, category
5. Search entries by text
6. This is the manager's daily logbook — simple text entries with timestamps

## DATA IMPORTS (src/pages/admin/DataImports.tsx)

Already has ImportWizard. Enhance:
1. Import types on the page:
   - Sales Data (TASK POS Excel)
   - Ingredients (CSV/Excel)
   - Suppliers (CSV/Excel)
   - Staff (CSV/Excel)
   - Menu Items (CSV/Excel)
2. Import history table: date, type, file name, records imported/skipped/errored, imported by
3. Store history in admin_data_jobs or a dedicated import_history table

## INTEGRATIONS (src/pages/automation/Integrations.tsx)

Replace stub with a "coming soon" page that looks professional:
- Show planned integrations: Square POS, Xero, MYOB, KeyPay
- Each with a "Coming Soon" badge
- Brief description of what each integration will do
- "Notify me" button (just stores interest for now)

Run npm run build after all changes.
```

---

## PHASE 3: INTEGRATION, POLISH & DEPLOY (3-5 days)

---

### Task 13: Cross-Module Wiring & Navigation
**Status:** TODO
**Dependencies:** Tasks 6-12

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 13 — wire everything together.

## COST CASCADE (critical)
When an ingredient cost changes (from any source):
1. Update ingredient.cost_per_unit in Supabase
2. Log to ingredient_price_history
3. Find all recipe_ingredients using this ingredient
4. Recalculate each recipe's cost_per_serve
5. Update each linked menu_item's GP%
6. If GP% drops below venue target → add to alerts

Wire this cascade from:
- Ingredient edit form (IngredientForm.tsx)
- Invoice approval (when price differs from PO)
- PO receiving (when accepting a new price)
- Bulk import (ingredient price column)

## INVENTORY DEPLETION (theoretical)
When sales are imported:
- For each item sold with a menu_item_id
- Look up recipe → recipe_ingredients
- Deduct theoretical quantities from ingredient stock tracking
- This feeds variance reporting (actual count vs theoretical)

## NAVIGATION SIDEBAR (src/components/Layout.tsx)
Ensure the sidebar has ALL pages in logical groups:

Dashboard (home icon)

Menu
├─ Recipes
├─ Menu Items
└─ Ingredients

Inventory
├─ Stock Counts
├─ Waste Log
├─ Purchase Orders
└─ Order Guide

Labour
├─ Roster
├─ Timesheets
├─ Payroll
└─ Reports

People
├─ Staff List
└─ Onboarding (maybe under People or separate)

Suppliers

Operations
├─ Daybook
└─ Compliance

Admin (collapsible, bottom of sidebar)
├─ Organisation Settings
├─ Venue Settings
├─ Locations & Storage
├─ Access & Roles
├─ Data Imports
└─ Integrations

## ROUTE VERIFICATION (src/App.tsx)
- Every sidebar link points to a real route
- Every route renders a real page
- Remove any routes to non-existent pages
- No route loops or dead ends
- 404 page catches unknown routes

Run npm run build after all changes.
```

---

### Task 14: UX Polish, Validation & Empty States
**Status:** TODO
**Dependencies:** Task 13

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 14 — final UX polish.

## FORM VALIDATION — check EVERY form
All forms must use react-hook-form + zodResolver. Check each one:
- Required fields enforced with error messages
- Email: valid email format
- Phone: AU format (04XX XXX XXX)
- ABN: 11 digits
- BSB: 6 digits (NNN-NNN)
- TFN: 9 digits
- Money: positive numbers, 2dp max
- Dates: valid, sensible range
- Inline error messages below each field (red text)

## EMPTY STATES — every data page needs one
Use the existing EmptyState component. Each must have:
- Relevant icon
- Descriptive message
- Primary action button

Examples:
- Dashboard: "Welcome to SuperSolt! Import your sales data to see metrics." → [Import Data]
- Recipes: "No recipes yet. Start building your recipe library." → [Create Recipe]
- Roster: "No shifts this week. Build your first roster." → [Create Shift]
- Ingredients: "No ingredients added. Add ingredients to start costing recipes." → [Add Ingredient]
- Staff: "No team members yet." → [Invite Staff]

## LOADING STATES — every data fetch needs one
- Use Skeleton components (shadcn) for list pages
- Use Spinner for form submissions
- Never show blank page while loading

## TOAST NOTIFICATIONS
- Every successful save: green toast "Saved successfully" (via sonner)
- Every error: red toast with helpful message (never show raw DB errors)
- Every delete: confirm dialog first, then toast on success

## RESPONSIVE
- All pages must work on desktop (1024px+) and tablet (768px+)
- Tables should scroll horizontally on small screens
- Forms should stack vertically on mobile
- Sidebar should collapse on tablet

## DARK MODE
- next-themes is installed — verify theme toggle works
- All pages render correctly in light and dark mode
- Charts must have proper contrast in dark mode

## CONSISTENCY CHECK
- All monetary values displayed as "$X,XXX.XX" (AU format)
- All dates displayed as "DD/MM/YYYY" (AU format)
- All times displayed as "HH:MM AM/PM" or 24-hour (based on venue_settings)
- All percentage displays as "XX.X%"
- Page titles consistent (use PageShell component)
- Button styles consistent (primary = blue, destructive = red, secondary = gray)

Run npm run build. Fix ALL warnings.
Run npx tsc --noEmit. Fix ALL type errors.
```

---

### Task 15: Security Hardening & Deployment
**Status:** TODO
**Dependencies:** Task 14

**Prompt for Claude Code:**
```
Read tasks.md for context. This is Task 15 — final security and deploy prep.

## SECURITY SCAN
1. Search entire src/ for:
   - Hardcoded API keys, tokens, secrets
   - "service_role" references
   - console.log outputting tokens, passwords, PII
   - Remove all found

2. Verify ALL RLS policies (Task 2 should have fixed this):
   - Run: SELECT tablename FROM pg_tables WHERE schemaname = 'public'
   - For each table: SELECT * FROM pg_policies WHERE tablename = X
   - Flag any without policies

3. Check Supabase storage buckets:
   - Documents bucket: private (authenticated access only)
   - Photos bucket: public read, authenticated write

## ENVIRONMENT
- .env.local is in .gitignore ✓ (audit confirmed)
- Create .env.example with:
  ```
  VITE_SUPABASE_URL=your_supabase_project_url
  VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
  ```

## CLEANUP
- Search for TODO, FIXME, HACK comments — list all, decide which block launch
- Remove unused imports (TypeScript compiler will flag these)
- Remove any commented-out code blocks
- Remove the duplicate src/lib/data/store.ts if not done in Task 1

## CREATE DEPLOYMENT_CHECKLIST.md
```markdown
# SuperSolt Deployment Checklist

## Supabase Setup
- [ ] Create production Supabase project
- [ ] Run all migrations in order
- [ ] Verify RLS policies active on all tables
- [ ] Create storage buckets: documents (private), photos (public)
- [ ] Set up email templates (password reset, invite)

## Environment
- [ ] Set VITE_SUPABASE_URL in hosting environment
- [ ] Set VITE_SUPABASE_PUBLISHABLE_KEY in hosting environment

## First Run
- [ ] Create owner account via signup
- [ ] Set up organisation details
- [ ] Configure venue settings (trading hours, targets, timezone)
- [ ] Set up storage locations
- [ ] Import initial data: ingredients, suppliers
- [ ] Import TASK POS sales data
- [ ] Create staff records
- [ ] Build first roster
- [ ] Run first stock count

## Smoke Test
- [ ] Login works
- [ ] Dashboard shows imported data
- [ ] Can create/edit/delete ingredient
- [ ] Can create recipe with costing
- [ ] Can create roster with penalty rates
- [ ] Can import TASK POS file
- [ ] Can log waste
- [ ] Can create PO
- [ ] Settings save and persist
```

## FINAL BUILD
- npm run build → 0 errors, 0 warnings
- npx tsc --noEmit → 0 type errors
- All routes working
- All pages render in light and dark mode
- Ready to deploy

Run npm run build one final time.
```

---

## Timeline Summary

| Phase | Tasks | What | Est. Days |
|-------|-------|------|-----------|
| **Phase 1** | Tasks 1-5 | Fix foundation: types, RLS, data flow, recipes | 3-4 |
| **Phase 2** | Tasks 6-12 | Production-quality modules | 14-18 |
| **Phase 3** | Tasks 13-15 | Integration, polish, deploy | 3-5 |

**Total: ~20-27 days working with Claude Code**

## Key Insight from Audit

You're further along than you think. The labourService, ingredients, suppliers, POs, stock counts, waste, menu items, venue settings, access roles, and locations ALL have real Supabase persistence. The main work is:

1. **Fix the types** (Task 1) — unblocks everything
2. **Fix RLS** (Task 2) — security
3. **Wire recipes** (Task 3) — biggest broken module
4. **Wire dashboard** (Task 4) — most visible
5. **Then polish each module** (Tasks 6-12) — from "works" to "production-ready"

---

## Phase 2 Features (NOT in scope — do after launch)

- Mobile app (clock-in/out, shift viewing, leave requests)
- Square POS live API integration
- Xero/MYOB live accounting sync
- AI Ops Copilot (text commands)
- OCR invoice scanning
- Barcode scanning
- Automated roster generation
- Supplier portal
- Multi-site consolidation
