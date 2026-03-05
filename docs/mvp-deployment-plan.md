# SuperSolt MVP Deployment Plan
_Created: 2026-03-05 | Target: PPB Hawthorn + PPB South Yarra_

---

## Venue Profile

### PPB Hawthorn
| Item | Detail |
|------|--------|
| POS system | ✅ Square |
| Approximate staff count | ~20 |
| Current rostering tool | Deputy |
| Current inventory method | ❌ None — no food cost tracking |
| Current accounting | ❓ TBC |
| Day-to-day manager | **Damien** |
| Biggest pain point | **Ordering & inventory management** |

### PPB South Yarra
| Item | Detail |
|------|--------|
| POS system | ✅ Square |
| Approximate staff count | ~20 |
| Current rostering tool | Deputy |
| Current inventory method | ❌ None — no food cost tracking |
| Current accounting | ❓ TBC |
| Day-to-day manager | **Stephen** |
| Biggest pain point | **Ordering & inventory management** |

### Key Context
- **Separate ABNs** — two distinct organisations in SuperSolt (not one org with two venues)
- **Award:** Restaurant Industry Award — mostly Level 1 and Level 2, plus a few salaried staff
- **No food cost tracking today** — SuperSolt will be their first system for this. Massive opportunity but also means we need to make data entry painless.
- **Pain point is ordering/inventory** — this should be the hero flow at launch, not just dashboard/roster

### Trading Hours (Both Venues)

| Day | Open | Close |
|-----|------|-------|
| Monday | 8:00 AM | 3:00 PM |
| Tuesday | 8:00 AM | 3:00 PM |
| Wednesday | 8:00 AM | 3:00 PM |
| Thursday | 8:00 AM | 3:00 PM |
| Friday | 8:00 AM | 3:00 PM |
| Saturday | 9:00 AM | 2:00 PM |
| Sunday | 9:00 AM | 2:00 PM |

**Key insight:** These are breakfast/brunch/lunch venues — no dinner service. All trade is compressed into 5-7 hours. This means:
- Roster complexity is lower (one daypart, no split shifts)
- Peak labour is concentrated (setup → service → close)
- No evening penalty rates to worry about (all shifts end by 3pm)
- Forecasting granularity can be daily, not hourly

### Accounting
- **Xero** — both venues. Xero integration is planned for v2.0 (~$30-50K specialist work). Not MVP but good to know the target.

---

## Current State Audit

### Module Status — Honest Assessment

| Module | Status | DB Reads | DB Writes | Notes |
|--------|--------|----------|-----------|-------|
| **Auth / Login** | ✅ LIVE | ✅ | ✅ | Supabase Auth, email/password, org/venue context |
| **Setup Wizard** | ✅ LIVE | ✅ | ✅ | Org → venues → POS → invite team → go-live |
| **Multi-venue Switching** | ✅ LIVE | ✅ | ✅ | AuthContext handles venue selection, persists to localStorage |
| **POS Sync (Square)** | ✅ LIVE | ✅ | ✅ | OAuth2, order sync, location mapping. Encrypted tokens. Serverless functions on Vercel. |
| **Dashboard** | 🟡 PARTIAL | ✅ | N/A | Reads orders from DB, calculates KPIs. Charts work. But KPI targets hardcoded (28% labour, 65% GP) — not venue-configurable. Labour cost data not connected to actual roster costs. |
| **Sales** | 🟡 PARTIAL | ✅ | N/A | Reads from orders table. Filters by date/channel. Works if POS is synced. No sales forecasting. |
| **Roster** | 🟡 PARTIAL | ✅ | ✅ | Dedicated store (useRosterStore) with Supabase reads/writes. Shift CRUD, drag-drop, compliance warnings, publish flow, templates, auto-fill, real-time subscriptions. **But:** no award rate engine — costs are estimates, not actual award calculations. |
| **Timesheets** | 🔴 STUB | ❌ | ❌ | UI exists (454 lines). Reads from Zustand only. No DB persistence. Approve/reject is local state. |
| **People / Staff** | 🔴 STUB | Partial | Partial | Invite flow writes to `staff_invites` (DB). But `addStaff` is **Zustand-only** — creating staff doesn't persist to DB. Fake IDs (`staff-${timestamp}`) break FK relationships. |
| **Onboarding** | 🟡 PARTIAL | ✅ | ✅ | Token-based invite links work. Step forms (contact, address, bank, TFN, super, docs, policies) write to DB. But step progress not persisted — closing browser loses progress. |
| **Recipes** | ✅ LIVE | ✅ | ✅ | Recipe list + editor. Ingredient builder with cost calcs, GP% targeting. `saveRecipeToDB` via service layer. |
| **Menu Items** | 🟡 PARTIAL | ✅ | Via store | Loads from DB. Links to recipes. But menu item CRUD goes through dataStore — need to verify full write path. |
| **Ingredients** | ✅ LIVE | ✅ | ✅ | Full CRUD via dataStore → Supabase. Price history, cost cascading, allergen tracking. |
| **Suppliers** | ✅ LIVE | ✅ | ✅ | Full CRUD via dataStore → Supabase. Contact info, payment terms. |
| **Purchase Orders** | ✅ LIVE | ✅ | ✅ | Create, line items, status workflow. Writes to DB. |
| **Stock Counts** | ✅ LIVE | ✅ | ✅ | Create, count items, complete. Writes to DB. |
| **Waste Tracking** | ✅ LIVE | ✅ | ✅ | Log waste entries with ingredient, qty, reason. Writes to DB. |
| **Order Guide** | 🟡 PARTIAL | ✅ | N/A | Shows ingredients with reorder points. Read-only view. Doesn't auto-generate POs. |
| **Inventory Reports** | 🟡 PARTIAL | ✅ | N/A | Charts and tables. No export (CSV/PDF). |
| **Daybook** | 🔴 STUB | ✅ Read | ❌ Write | Reads existing entries from DB. But `handleSubmit` writes to **local state only** — new entries don't persist. |
| **Payroll** | 🔴 STUB | ❌ | ❌ | Reads from Zustand. No DB data. No actual payroll calculations. |
| **Compliance** | 🔴 STUB | ❌ | ❌ | Page exists with checklist UI. No real compliance checks. |
| **Settings (Org)** | ✅ LIVE | ✅ | ✅ | Org profile, branding, defaults. Reads/writes to DB. |
| **Settings (Venue)** | ✅ LIVE | ✅ | ✅ | Venue-specific overrides. Writes to DB. |
| **Locations** | ✅ LIVE | ✅ | ✅ | Storage locations, count zones. |
| **Integrations** | ✅ LIVE | ✅ | ✅ | Square connect/disconnect/sync. |
| **Access Roles** | 🟡 PARTIAL | ✅ | ✅ | Org member management. Invite flow works. Role assignment works. |
| **Data Imports** | 🟡 PARTIAL | ✅ | ✅ | Excel/CSV import for ingredients, suppliers. Invoice OCR UI exists. |

### Summary
- **7 modules LIVE** (full DB read/write): Auth, POS, Recipes, Ingredients, Suppliers, POs, Stock Counts, Waste, Settings, Locations
- **6 modules PARTIAL** (UI works, gaps in data flow): Dashboard, Sales, Roster, Menu Items, Onboarding, Order Guide, Reports, Access Roles, Data Imports
- **4 modules STUB** (UI only, no persistence): Timesheets, People/Staff, Daybook, Payroll, Compliance

---

## MVP Scope — What Ships

### Three Differentiators We're Deploying

**1. Unified Venue P&L** — POS revenue + labour cost + food cost in one dashboard view
**2. Award-Aware Labour Budgeting** — See actual labour cost % on the roster before you publish
**3. Recipe-to-Margin Pipeline** — Recipe cost → menu price → GP% → actual sales margin

### Feature Scope

| Feature | What Exists | What's Missing | Effort | Builder |
|---------|-------------|----------------|--------|---------|
| **Dashboard: Real P&L view** | KPI cards + charts from POS data | Labour cost needs real roster data (not hardcoded). Food cost needs recipe-to-sales mapping. Venue-configurable targets. | 3 days | Bot |
| **POS Sync: Square orders flowing** | ✅ Complete | Needs testing with live venue data. Auto-sync on schedule (cron/webhook). | 1 day | Bot |
| **Staff management: DB persistence** | UI exists, invite flow works | `addStaff` must write to Supabase. Fix fake IDs. Load staff from DB. | 2 days | Bot |
| **Roster: Labour cost integration** | Shift CRUD works, compliance warnings work | Cost calculation uses estimates — needs staff pay rates from DB. Basic award rate lookup (base rate × penalty multiplier). Budget vs actual display. | 4 days | Bot |
| **Recipes: Fully working** | ✅ Complete | Minor: batch recipe import for initial data load | 0.5 days | Bot |
| **Ingredients: Fully working** | ✅ Complete | Minor: bulk import from supplier price list | 0.5 days | Bot |
| **Suppliers: Fully working** | ✅ Complete | None for MVP | 0 | — |
| **Daybook: DB persistence** | UI reads from DB, writes to local state | Fix `handleSubmit` to write to Supabase | 0.5 days | Bot |
| **Venue-configurable KPI targets** | Hardcoded in Dashboard | Pull targets from venue_settings. Settings UI already exists. | 1 day | Bot |
| **Multi-venue switching** | ✅ Complete | Test with two real venues under one org | 0.5 days | Bot |
| **Error tracking** | ❌ Missing | Add Sentry (free tier). ErrorBoundary already exists (has TODO for Sentry). | 0.5 days | Bot |
| **Basic labour cost engine** | Roster has cost fields | Simplified AU award: base hourly rate × time-of-day multiplier × day-of-week multiplier. NOT full Fair Work engine — that needs a specialist. | 3 days | Bot |

**Total estimated effort: ~16.5 dev days across 4 weeks**

### What Makes This an MVP (Not a Demo)

After these fixes, a venue manager can:
1. Open the app and see **today's sales** (from Square, live)
2. See **this week's labour cost** as a % of revenue (from roster, calculated)
3. See **food cost %** based on recipe costs vs menu prices
4. Build **next week's roster** with cost shown per shift
5. Track **inventory** (ingredients, stock counts, waste, POs)
6. Manage **staff** (add, invite to onboarding, assign roles)
7. Log **daily operations** in the daybook

---

### Forecasting Module (Added Per Morty's Requirement)

Forecasting is critical for accurate ordering, labour budgeting, and food cost control. Without it, managers are guessing.

| Feature | What It Does | Data Source | Effort | Sprint |
|---------|-------------|-------------|--------|--------|
| **Sales forecast (weekly)** | Predict next week's revenue by day using same-period-last-year + recent trend | Square order history (needs 4+ weeks of data) | 2 days | Sprint 2 |
| **Labour budget from forecast** | Auto-calculate target labour $ per day: forecast revenue × target labour % | Sales forecast + venue settings | 0.5 days | Sprint 2 |
| **Order quantity forecast** | Suggest order quantities per ingredient based on: forecast revenue × sales mix × recipe usage | Sales forecast + recipe-to-POS mapping + recipe ingredients | 2 days | Sprint 3 |
| **Forecast vs actual tracking** | Show how accurate the forecast was after the week ends. Builds trust + improves model over time. | Forecast saved vs actual POS data | 1 day | Sprint 4 |

**Forecasting approach (MVP):**
- **Week 1-4 of data:** Use simple averages (last 4 weeks same-day average)
- **Week 5+:** Weighted moving average (recent weeks weighted higher) + day-of-week seasonality
- **NOT building:** ML models, weather correlation, event-based adjustments — those are v2.0
- **Key insight:** Even a simple "last 4 Tuesdays averaged $X" is better than guessing, and it gets more accurate every week

**Critical dependency:** Venues need to connect Square ASAP — every day of POS data we capture improves forecast accuracy. Backfill last 90 days on connect.

---

## MVP Scope — What Gets Cut

| Feature | Why It's Cut | When It Returns |
|---------|-------------|-----------------|
| **Full Fair Work award engine** | Needs specialist dev (~$15-20K). Rules are complex (casual loading, overtime tiers, public holidays, penalty rates by award classification). | v1.2 — specialist engagement |
| **Timesheets (DB persistence)** | Roster is the priority. Timesheets need clock-in/out hardware or mobile app integration. | v1.1 — after roster is proven |
| **Payroll export** | Needs timesheet data + award calculations to be meaningful. | v1.2 — after timesheets |
| **Xero/MYOB integration** | Specialist dev (~$30-50K). Not day-1 essential — venues already have accountants. | v2.0 — specialist engagement |
| **VEVO / ATO integrations** | Government APIs need specialist (~$8-15K). Compliance-critical but not day-1. | v2.0 — specialist engagement |
| **E-signatures** | DocuSign/SignNow API (~$2K). Onboarding works without it — managers print and sign. | v1.1 |
| **Inventory depletion (auto-deduct from sales)** | Needs recipe-to-POS item mapping + depletion engine. Complex. | v1.2 |
| **Sales forecasting** | Needs historical data (>3 months) to be useful. Venues won't have it day 1. | v1.2 — after 3 months of data |
| **Mobile app** | PWA via Vercel works on mobile browsers. Native app is premature. | v2.0 |
| **AI features** | No training data, no user patterns yet. | v2.0 |
| **Invoice OCR** | UI exists in Data Imports. Needs OCR service integration. | v1.1 |
| **Compliance checklists** | Page is a stub. Not day-1 essential. | v1.1 |

---

## Standout Features — What Would Make Operators Talk

### 1. 🎯 Morning Briefing Dashboard
**What:** When a manager opens SuperSolt at 7am, they see one screen:
- Yesterday's revenue vs target (from Square)
- This week's labour cost % (from roster)
- Food cost % (from recipes × sales mix)
- Today's roster with labour budget remaining
- Any compliance warnings (consecutive days, no break scheduled)

**Why operators talk:** "I used to check three apps and a spreadsheet before I even made coffee. Now it's one screen."

**Data needed:** Square connected, current week's roster published, recipe costs entered for top 20 items.

**Effort:** 2 days (Dashboard already 80% there — need to wire labour and food cost data)

### 2. 💰 Live Labour Budget on Roster
**What:** As you drag shifts onto the roster, you see:
- Running total labour cost for the week
- Labour % of forecasted revenue (based on same-week-last-month from POS)
- Color indicator: green (<28%), amber (28-32%), red (>32%)
- Per-day breakdown showing which days are over/under budget

**Why operators talk:** "I can see I'm $400 over budget on Saturday before I even publish the roster."

**Data needed:** Staff pay rates (base hourly), roster shifts, POS historical revenue. The CostBar component already exists — it just needs real data.

**Effort:** 3 days (CostBar exists, need real rate calculation + POS revenue lookup)

### 3. 📊 Menu Item Profitability Ranking
**What:** A simple table showing every menu item ranked by:
- Theoretical food cost %
- GP $ per item
- Sales volume (from POS)
- Contribution margin (GP$ × volume)

Highlight: items with high volume but low margin (fix your pricing), and items with high margin but low volume (promote these).

**Why operators talk:** "I found out my best-selling burger was actually my lowest margin item. Changed the spec, saved $800/week."

**Data needed:** Recipes with ingredient costs, POS item-level sales data (Square provides this).

**Effort:** 2 days (Recipe data exists, need to map POS items → recipes and build the ranking view)

### 4. 📱 One-Tap Staff Onboarding
**What:** Manager adds a new staff member → taps "Send Invite" → staff gets a link → completes TFN declaration, bank details, super choice, emergency contacts — all on their phone.

**Why operators talk:** "New staff member started Monday, had all their paperwork done before they walked in the door."

**Data needed:** None — this flow already works. Just needs staff write-to-DB fix and some mobile polish.

**Effort:** 1.5 days (fix staff DB persistence + mobile CSS on onboarding portal)

### 5. 🏪 Multi-Venue Comparison
**What:** PPB owner opens SuperSolt and sees both venues side-by-side:
- Hawthorn vs South Yarra: revenue, labour %, food cost %, covers
- Identify which venue is more efficient this week
- Drill into any venue for details

**Why operators talk:** "I can finally compare my two stores without waiting for my accountant's monthly report."

**Data needed:** Both venues connected to Square, both with rostering data.

**Effort:** 1.5 days (multi-venue switching exists — need a comparison dashboard view)

---

## Data Requirements

### Before Go-Live: What We Need From Each Venue

| Data | Format | Who Provides | Priority |
|------|--------|-------------|----------|
| **Square POS access** | OAuth connection via SuperSolt UI | Venue manager (with Square login) | 🔴 P0 — blocks everything |
| **Staff list** | Names, roles, employment type (casual/PT/FT), base hourly rate | Morty / venue manager | 🔴 P0 — needed for roster costing |
| **Trading hours** | Open/close per day, daypart definitions | Morty | 🔴 P0 — needed for roster |
| **Top 20 recipes** | Ingredient list + quantities per serve (even rough) | Venue chef/manager | 🟡 P1 — needed for food cost % |
| **Supplier list** | Name, contact, what they supply | Venue manager | 🟡 P1 — needed for PO flow |
| **Key ingredient costs** | Top 50 ingredients with current pack price + pack size | Venue manager / invoices | 🟡 P1 — needed for recipe costing |
| **Current roster template** | Who works which days/times (even a photo of the whiteboard) | Venue manager | 🟡 P1 — seed the first roster |
| **Award classifications** | Which award each staff member is on + level (e.g., Restaurant Industry Award L2) | Morty | 🟡 P1 — needed for labour cost accuracy |

---

## Deployment Checklist

### Infrastructure

| Item | Status | Action |
|------|--------|--------|
| Vercel production deploy | ✅ Already deployed | Verify env vars are production Supabase |
| Custom domain | ❌ Not set | Register `app.supersolt.com.au` or similar. Point DNS to Vercel. |
| SSL certificate | ✅ Auto via Vercel | — |
| Supabase production project | ✅ `vcfmouckydhsmvfoykms` | Verify RLS policies on all 53 tables |
| Environment variables (Vercel) | 🟡 Need verification | Check: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SQUARE_APP_ID`, `SQUARE_APP_SECRET`, `SQUARE_HMAC_SECRET`, `AES_KEY`, `APP_URL` |
| Error tracking (Sentry) | ❌ Not set | Add Sentry free tier. Wire to ErrorBoundary. |
| Backup strategy | ✅ Supabase auto-backups | Confirm backup retention on current plan |
| Monitoring | ❌ None | Vercel analytics (free). Supabase dashboard for DB health. |

### Per-Venue Setup

For **each** venue (Hawthorn + South Yarra):

1. [ ] Create org in SuperSolt (if same business, one org with two venues)
2. [ ] Create venue record with correct details (name, address, timezone, ABN)
3. [ ] Create user accounts for venue managers (email/password)
4. [ ] Connect Square POS via OAuth flow
5. [ ] Verify Square locations map to correct venues
6. [ ] Run initial POS sync (backfill last 30 days of orders)
7. [ ] Enter staff list with roles and base pay rates
8. [ ] Enter supplier list
9. [ ] Enter top 20 ingredients with costs
10. [ ] Enter top 20 recipes with ingredients
11. [ ] Build first week's roster
12. [ ] Configure venue KPI targets (labour %, food cost %, revenue target)
13. [ ] Test full flow: dashboard → roster → recipes → daybook

---

## Sprint Plan (4 Weeks)

### Sprint 1 (Week 1): Fix Foundation + Connect POS
**Goal:** Both orgs created, Square connected, historical data flowing. Fix all DB persistence gaps.

| Task | Effort | Details |
|------|--------|---------|
| Create two orgs in SuperSolt | 0.5 days | PPB Hawthorn (org 1) + PPB South Yarra (org 2). Separate ABNs = separate orgs. User accounts for Damien + Stephen. |
| Connect Square POS (both venues) | 0.5 days | OAuth flow with Morty present. Backfill last 90 days of orders per venue. |
| Fix `addStaff` to write to Supabase | 1 day | Replace Zustand-only with DB-first. Fix fake ID generation. Load staff from `staff` table. |
| Fix Daybook `handleSubmit` to write to DB | 0.5 days | Currently writes to local state. Wire to Supabase. |
| Add Sentry error tracking | 0.5 days | Free tier. Wire to existing ErrorBoundary. |
| Bulk data import: ingredients CSV | 0.5 days | Template: Ingredient, Category, Unit, Pack Size, Pack Cost, Supplier. Manager fills in, we import. |
| Bulk data import: staff CSV | 0.5 days | Template: Name, Role, Employment Type, Hourly Rate, Award Level. |
| POS auto-sync via webhook | 0.5 days | Square webhook triggers sync on new orders. No manual sync needed. |

**Definition of Done:** Both venues connected to Square with 90 days of sales data. Staff and daybook write to DB. Sentry live. Damien and Stephen can log in and see their sales dashboard.

**What Morty needs to provide:**
- Square login credentials (to authorise OAuth) for both venues
- Staff lists: name, role, casual/PT/FT, hourly rate, award level (L1/L2/salaried)
- 30 mins with Morty to do the Square connection together

---

### Sprint 2 (Week 2): Inventory & Ordering (Pain Point)
**Goal:** Damien and Stephen can manage ingredients, suppliers, and place purchase orders. This is their #1 pain point — nail it.

| Task | Effort | Details |
|------|--------|---------|
| Supplier data entry (both venues) | 0.5 days | Morty provides supplier list → we import. Or managers enter via UI. |
| Ingredient data entry (top 50 per venue) | 1 day | Use bulk import template. Include: pack size, pack cost, supplier, reorder point, par level. |
| Order Guide: auto-suggest quantities | 1.5 days | Current Order Guide is read-only. Add: current stock (from last count) − par level = suggested order qty. One-click "Create PO from suggestions." |
| PO → Supplier email | 1 day | Generate PO as PDF. One-click email to supplier (mailto: link with attachment, or basic email via Supabase Edge Function). |
| Sales forecast (weekly) | 2 days | Predict next week's revenue by day from Square history (4-week weighted average). Display on Dashboard + Roster. |

**Definition of Done:** Managers can do a stock count → see what to order → create a PO → send it to their supplier. All in SuperSolt. Sales forecast shows predicted revenue by day.

**What Morty needs to provide:**
- Supplier list per venue (name, email, what they supply)
- Top 50 ingredients per venue with current costs (can delegate to Damien/Stephen)
- Current par levels / reorder points (even rough: "we usually order 10kg chicken per week")

---

### Sprint 3 (Week 3): Recipes + Labour Costing + Forecasting
**Goal:** Food cost % is real. Roster shows actual labour costs. Forecast drives ordering suggestions.

| Task | Effort | Details |
|------|--------|---------|
| Recipe bulk import | 1 day | Template: Recipe Name, Ingredient, Qty, Unit. Top 20 menu items per venue. |
| POS item → Recipe mapping | 1 day | UI to link Square catalog items to SuperSolt recipes. Enables food cost per sale. |
| Theoretical food cost on Dashboard | 1 day | (recipe cost × items sold) ÷ revenue = food cost %. Live KPI card. |
| Basic award rate calculator | 2 days | Base rate × day multiplier (weekday 1.0, Sat 1.25, Sun 1.5, PH 2.5) × casual loading (+25%). Label as "estimated". |
| Wire CostBar to real rates | 0.5 days | CostBar exists → replace estimates with: shift hours × calculated rate. |
| Labour budget from forecast | 0.5 days | Forecast revenue × target labour % = daily labour budget on roster. |
| Order quantity forecast | 1 day | Forecast revenue × sales mix × recipe usage = suggested ingredient order quantities. |
| Venue KPI targets from settings | 0.5 days | Pull targets from venue_settings. Replace hardcoded values. |

**Definition of Done:** Dashboard shows real food cost % and real labour %. Roster shows dollar cost per shift. Order Guide suggests quantities based on forecast. Menu profitability visible.

**What Morty needs to provide:**
- Top 20 recipes per venue with ingredient quantities (even rough — "200g chicken, 50g sauce")
- Pay rates confirmed for all staff
- Target KPIs per venue (labour %, food cost %, weekly revenue target)

---

### Sprint 4 (Week 4): Polish + Go-Live
**Goal:** Production-ready. Both venues live. Managers using it daily.

| Task | Effort | Details |
|------|--------|---------|
| Morning briefing dashboard | 1 day | The "open at 7am" view: yesterday's P&L, today's roster + labour budget, this week's forecast vs actual, inventory alerts. |
| Menu item profitability ranking | 1 day | Items ranked by GP%, contribution margin. "Your best seller is your worst margin item." |
| Forecast vs actual tracking | 1 day | After each week: show how accurate the forecast was. Builds trust. |
| Mobile responsiveness pass | 1 day | Test: Dashboard, Order Guide, Stock Count, Daybook on iPhone. Fix broken layouts. |
| Custom domain + SSL | 0.5 days | `app.supersolt.com.au` on Vercel. |
| Venue 1 go-live (Hawthorn — Damien) | 0.5 days | Data check. 30 min walkthrough. Go live. |
| Venue 2 go-live (South Yarra — Stephen) | 0.5 days | Same as above. |
| Bug buffer | 1.5 days | Reserved for go-live issues. |

**Definition of Done:** Both venues live. Damien and Stephen log in daily. Dashboard shows real P&L. Order Guide drives purchasing. Sentry monitoring active. Zero critical bugs for 7 days.

**What Morty needs to provide:**
- 30 mins per venue for manager walkthrough
- Mobile testing feedback
- Map Square menu items → recipes (we provide the UI, manager confirms the links)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **~~Venues don't use Square POS~~** | ~~Medium~~ | ~~Critical~~ | ✅ **RESOLVED** — both venues confirmed Square. |
| **Staff pay rate data not available** | Medium | 🟡 High — labour cost engine is meaningless without rates | Provide a template spreadsheet. Even approximate rates (e.g., "casuals are $28/hr") work for MVP. |
| **Recipe data too rough** | Medium | 🟡 High — food cost % will be inaccurate | Start with top 10 items, not 20. Even rough specs (200g chicken, 50g sauce) give directional accuracy. |
| **Award rate simplification causes distrust** | Medium | 🟡 Medium — if labour cost is visibly wrong, managers won't trust the tool | Label it clearly: "Estimated labour cost — based on simplified rates". Add a disclaimer. Plan specialist dev for v1.2. |
| **Supabase DNS issues recur** | Low | 🔴 Critical — app completely unusable | Monitor status.supabase.com. Have DNS fallback instructions ready. Consider CDN/edge caching for static assets. |
| **Morty's time becomes bottleneck** | High | 🟡 High — data entry and venue coordination depend on Morty | Front-load data collection in Week 1. Provide templates. Delegate data entry to venue managers where possible. |
| **Venue managers resist adoption** | Medium | 🟡 High — tool is useless if no one opens it | Lead with ordering/inventory — their stated pain point. If the Order Guide saves them time on their first order, they'll come back. Dashboard is the second hook. |
| **Ingredient/recipe data entry burden** | High | 🟡 High — food cost % is meaningless without accurate recipe data | Provide CSV templates. Start with top 20 items, not everything. Even rough quantities give directional accuracy. Delegate to Damien/Stephen. |
| **Forecast accuracy in first month** | High | 🟡 Medium — simple averages may look wrong on unusual weeks | Label clearly: "Based on last 4 weeks." Show confidence level. Accuracy improves every week — track and display it. |
| **Separate orgs = double the setup work** | Low | 🟡 Medium — two orgs means two Square connections, two data loads | Front-load in Sprint 1. Template everything so Venue 2 setup is copy-paste from Venue 1. |
| **Security audit needed before handling real TFN/bank data** | Low | 🔴 Critical — compliance risk | Onboarding module exists but defer collecting sensitive PII until security review. Use it for non-sensitive steps only (contact, emergency contact). |

---

## Cost Summary

| Item | Cost | Notes |
|------|------|-------|
| **Vercel hosting** | Free (Hobby) or $20/mo (Pro) | Pro recommended for production: analytics, team access, more serverless invocations |
| **Supabase** | Free tier or $25/mo (Pro) | Free tier: 500MB DB, 50K auth users. Pro: 8GB, daily backups, more connections. **Pro recommended for production.** |
| **Custom domain** | ~$15/year (.com.au) | Register via Namecheap/Cloudflare |
| **SSL** | Free | Via Vercel |
| **Square API** | Free | No cost for OAuth + Orders API. Rate limits apply. |
| **Sentry** | Free tier | 5K errors/month. Sufficient for 2 venues. |
| **Employment lawyer (award engine review)** | $500-1,000 | Review simplified rate calculation logic. Not building full engine — just validating our multipliers aren't misleading. Optional for MVP, recommended before v1.1. |
| **Total monthly (production)** | ~$45/month | Vercel Pro ($20) + Supabase Pro ($25) |
| **Total monthly (free tier)** | $0/month | Viable for pilot with 2 venues. Upgrade when needed. |

### Morty's Time Commitment

| Week | Hours | What |
|------|-------|------|
| Week 1 | 8-10 hrs | Collect venue data (staff lists, confirm POS, trading hours). Test staff management fixes. |
| Week 2 | 6-8 hrs | Enter pay rates. Test roster costing. Review labour % accuracy. |
| Week 3 | 8-10 hrs | Enter recipes (or delegate to chef). Map POS items to recipes. Test food cost view. |
| Week 4 | 6-8 hrs | Mobile testing. Manager walkthroughs. Go-live support. |

---

## Success Criteria

After 2 weeks of live usage, the MVP is successful if:

1. ✅ Both venue managers open SuperSolt **at least 3 times per week**
2. ✅ Dashboard shows **real revenue** (from Square) within 1 hour of close
3. ✅ Labour cost % is **within 5% of actual payroll** (validated against next pay run)
4. ✅ At least **10 recipes** entered with cost data per venue
5. ✅ Next week's roster is **built in SuperSolt** (not the old tool)
6. ✅ Zero critical bugs in Sentry for 7 consecutive days
