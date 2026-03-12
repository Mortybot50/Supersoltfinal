# UX Redesign Spec — SuperSolt

**Date:** 2026-03-12  
**Source:** Morty's Loom walkthrough + competitor analysis + codebase audit  
**Skills applied:** frontend-design, tailwind-design-system, web-design-guidelines

---

## What Makes SuperSolt Feel "AI-Made" Right Now

An honest assessment of every generic/sloppy pattern in the current UI:

### 1. Default shadcn Everything
The entire app looks like a shadcn/ui starter template. Every card, every button, every dropdown is stock Radix + Tailwind with zero customization. There's no visual identity — you could swap the logo and it could be any SaaS app.

### 2. No Typographic Hierarchy
- Page titles, card headers, section headers, and metric labels all blur together
- No clear visual weight system — everything is roughly the same size
- Missing `tabular-nums` on number columns (costs, hours, counts all shift when values change)
- No distinction between display numbers (KPIs) and body text

### 3. Inconsistent Card Treatments
- Dashboard cards use `rounded-lg border bg-card p-4`
- Some pages use `Card` + `CardHeader` + `CardContent` (adds extra padding)
- Others use raw `div` with `rounded-lg border`
- Padding varies: p-3, p-4, p-5, p-6 used randomly across pages
- Border radius inconsistent — some cards rounded-lg, some rounded-xl, some rounded-md

### 4. The Sidebar Problem
- Current sidebar is a basic accordion collapse pattern
- Morty explicitly said he doesn't like the double sidebar from PR #55
- Collapse/expand feels jarring, not animated
- No visual grouping — all nav items look the same weight
- Flyout tooltips on collapsed state are functional but not polished

### 5. Generic Colour System
- Primary colour is lime green (#B8E636) but it's barely used
- Most of the app is grey-on-white with blue/green status badges
- No warmth, no character — feels clinical
- Dark mode is just inverted greys, no personality
- Teal (#14b8a6) exists but is underused as an action colour

### 6. Tables Are Basic HTML
- People, Timesheets, Ingredients pages use basic tables with minimal styling
- No row hover effects, no zebra striping, no sticky headers
- No column alignment (numbers left-aligned instead of right)
- No loading skeletons — content just pops in
- No empty state illustrations — just text

### 7. Forms Feel Like Admin Panels
- Every form is a stack of label + input with no visual rhythm
- No inline validation feedback
- Submit buttons are generic Button with no loading state indication
- Dialogs/modals are stock Radix with no entrance animation

### 8. Zero Micro-Interactions
- No hover states on cards (things Morty specifically praised in Tandor)
- No transition on sidebar navigation
- No loading spinners beyond generic Skeleton
- No success feedback animations
- No progress indicators on multi-step flows

### 9. Dashboard Is Information-Dense But Flat
- 5 KPI cards in a row — all same visual weight, same size
- Charts are stock Recharts with default colours
- No visual hierarchy telling you what to look at first
- Quick links section is a basic list
- No "at a glance" feeling — you have to read everything

### 10. Mobile Is Broken
- Tables overflow horizontally with basic scroll
- Sidebar doesn't collapse into a proper mobile drawer
- Touch targets too small (h-7, h-8 buttons)
- No bottom navigation for mobile

---

## Competitor Pattern Library

### Navigation

**What the best do:**
- **Linear:** Single sidebar with icon + label, collapsible to icon-only (56px). Groups are subtle dividers, not accordions. Active item has a solid background pill. Keyboard-navigable.
- **Stripe Dashboard:** Left sidebar with sections. Active state is subtle left border + bold text. Clean, quiet.
- **7shifts:** Top-level tabs + contextual left sidebar per module. Clean separation between "where am I" (top) and "what can I do" (side).
- **Workday (from Loom):** Top tiles for primary actions + side sections. Hover tooltips. Section-based grouping.

**What SuperSolt does:** Accordion sidebar with group headers and sub-items. Collapse to icon flyouts. No top navigation. All items at same visual weight.

**Recommendation:**
- Single sidebar with grouped sections — not double rail, not accordion
- Icon + label for each nav item
- Groups separated by subtle dividers + tiny uppercase labels
- Active item: left accent border (brand green) + tinted background
- Hover: subtle background tint
- Mobile: full-width drawer from left + bottom tab bar (4 key sections)

### Cards & Containers

**What the best do:**
- **Linear:** Very subtle borders, generous padding (20-24px), consistent 8px radius. Shadow on hover only.
- **Stripe:** box-shadow instead of borders. Clean separation without heaviness. Hover elevates shadow slightly.
- **Nory:** Subtle gradient headers, rounded-xl, consistent 24px padding.

**What SuperSolt does:** Mix of border-only and shadow-only cards. Padding varies 12-24px. Radius varies 6-12px.

**Recommendation:**
- One card style globally: rounded-xl border border-border/50 bg-card shadow-sm
- Padding: p-5 standard, p-6 dashboard/metric
- Hover: hover:shadow-md transition-shadow duration-200

### Tables

**What the best do:**
- **Linear:** No visible borders, hairline row dividers. Hover highlight. Sticky header. Right-aligned numbers. Tabular-nums.
- **Stripe:** border-bottom on rows. Header is bold + uppercase + smaller. Row click navigates.
- **Deputy:** Avatars in rows, sortable columns, pagination.

**Recommendation:**
- Row dividers: single border-b (no vertical/cell borders)
- Header: text-xs font-medium text-muted-foreground uppercase tracking-wider
- Row hover: hover:bg-muted/50
- Numbers: text-right tabular-nums font-medium
- Currency: text-right tabular-nums font-semibold
- Sticky header, clickable rows, illustration empty states

### Dashboards

**What the best do:**
- **Stripe:** Hero metric large, supporting below. Charts secondary.
- **Square:** Sales overview big number + trend + period comparison.
- **Toast:** Today's Sales hero, breakdowns by hour/channel. Labour cost as percentage.

**Recommendation:**
- Hero section: Primary KPI large and prominent with trend
- 4 secondary metric cards below
- 2-column chart grid
- Activity feed / alerts at bottom

### Roster (from Loom analysis)

**Morty wants:**
- Tandor-style elegant shift tiles with hover highlighting
- Real-time cost/hour tracking per shift
- Click shift to manage breaks
- Vacant shifts show available staff filtered by availability + hours
- Drag to create shifts by exact time

**Recommendation:**
- Shift tiles: role colour-coded, hover lift, click → right panel
- Sticky labour cost bar at bottom
- Vacant shifts: dashed border, availability-filtered staff list

---

## Proposed Design System

### Colour System

```
Brand (Identity):     #B8E636 (50→900 scale)
Teal (Actions):       #14B8A6 (50→700 scale)
Neutrals:             Slate scale (50→900, not pure grey)
Semantic:             Success #22C55E, Warning #F59E0B, Error #EF4444, Info #3B82F6
```

### Typography Scale
```
Display:   text-4xl font-bold tracking-tight         — Hero metrics
Heading 1: text-2xl font-semibold tracking-tight      — Page titles
Heading 2: text-lg font-semibold                      — Section headers
Heading 3: text-base font-medium                      — Card headers
Body:      text-sm font-normal                        — Default text
Caption:   text-xs font-medium text-muted-foreground  — Labels, headers
Tiny:      text-[11px] font-medium uppercase tracking-wider — Group labels
```

All numbers: tabular-nums applied globally.

### Spacing System
```
Cards:  p-5 (standard), p-6 (dashboard)
Gaps:   gap-4 (cards), gap-6 (sections), gap-2 (inline)
Page:   px-6 py-6 (consistent on ALL pages)
```

### Card Pattern
```
Standard: rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-shadow
Metric:   Same + icon accent box + large number + trend indicator
```

### Navigation Pattern
- Single sidebar, 240px width
- Grouped sections with uppercase labels
- Active: left border brand-400 + bg-brand-50
- Mobile: drawer + 4-item bottom tab bar (Dashboard, Roster, Inventory, More)

### Micro-Interactions
- Card hover lift: hover:-translate-y-0.5 hover:shadow-md
- Row hover: hover:bg-slate-50
- Button press: active:scale-[0.98]
- Page enter: opacity 0→1 + translateY 4px→0 (200ms)

---

## Implementation Plan

### Commit 1: Design Tokens & CSS Variables (P0)
- src/index.css — Refined slate palette, brand/teal tokens, tabular-nums global, keyframes
- tailwind.config.ts — Updated colour defs, tracking-tight, font-feature-settings

### Commit 2: Navigation Redesign (P0)
- src/components/Layout.tsx — Full rewrite: single grouped sidebar, mobile drawer + bottom tabs

### Commit 3: Shared Components (P0)
- MetricCard.tsx — Icon accent, larger numbers, trend indicators
- PageShell.tsx — page-enter animation, standardized padding
- PageToolbar.tsx — Refined styling, consistent sizing
- StatusBadge.tsx — Add dot variant, standardize sizes
- EmptyState.tsx — Icon improvements, better CTA
- NEW: DataTable.tsx — Reusable: sticky header, hover rows, tabular-nums, sort

### Commit 4: Dashboard Redesign (P1)
- Dashboard.tsx — Hero metric, 4 secondary cards, 2-col charts, alerts

### Commit 5: Workforce Pages (P1)
- People.tsx — DataTable, avatar cards, role badges
- Roster.tsx + RosterShiftCard.tsx — Role colour tiles, hover lift, labour cost bar
- Timesheets.tsx — DataTable, tabular-nums
- Qualifications.tsx — Card-based expandable layout

### Commit 6: Inventory & Menu Pages (P1)
- Ingredients.tsx, StockCounts.tsx, PurchaseOrders.tsx, OrderGuide.tsx — DataTable throughout
- Recipes.tsx — Card grid with cost/GP indicators
- Suppliers.tsx — DataTable with contact info

### Commit 7: Insights, Operations, Admin (P1)
- Sales.tsx, Reports.tsx, InventoryInsights.tsx — Hero metrics + charts
- Daybook.tsx — Timeline layout
- OrgSettings, VenueSettings — Clean form sections
- AccessRoles.tsx — Permission grid
- Integrations.tsx — Status cards

### Commit 8: Micro-Interactions & Transitions (P2)
- Global CSS animations, nav transitions, loading states, success feedback

### Commit 9: Final Consistency Sweep (P2)
- Verify all pages: PageShell, padding, card treatment, tabular-nums, dark mode

---

## What NOT to Change

1. StatusBadge component — well-built
2. Auth flow — functional, not in scope
3. PageShell/PageToolbar architecture — good, just needs visual update
4. Data flow (Supabase → Zustand → components)
5. Routing structure
6. Form validation (Zod + React Hook Form)
7. Setup wizard
8. Error boundaries
9. Chart library (Recharts) — just restyle colours
10. Venue switcher — light visual update only

---

## Decisions Needed from Morty

1. Sidebar width: 240px (standard) or 220px (compact)?
2. Dark mode: polished in v1 or just "not broken"?
3. Font: Stay with Inter or try Geist/Satoshi?
4. Venue selector: dropdown or master restaurant list landing page (per Loom)?
5. Roster redesign depth: visual polish only or rethink interaction model?
