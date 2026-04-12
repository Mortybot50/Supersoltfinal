# Roster Redesign — Implementation Spec

## Overview

Complete redesign of the roster module. Build incrementally, commit after each major piece.
Branch: feature/roster-redesign (already created, you're on it).

## Tech Stack

- React 18 + TypeScript strict
- @dnd-kit/core + @dnd-kit/sortable (already installed)
- Zustand (NEW dedicated store: src/stores/useRosterStore.ts — NOT the monolith dataStore)
- Supabase real-time subscriptions
- Tailwind CSS + shadcn-ui components
- date-fns for date manipulation

## Architecture

### File Structure

```
src/
├── stores/
│   └── useRosterStore.ts          # Dedicated Zustand store for roster state
├── pages/labour/
│   └── Roster.tsx                 # Main page — REPLACE existing (keep old as RosterLegacy.tsx)
├── components/roster/
│   ├── RosterGrid.tsx             # Main grid container (week/day/fortnight views)
│   ├── RosterHeader.tsx           # View toggles, date nav, publish button, filters
│   ├── RosterRow.tsx              # Single staff row with shift cells
│   ├── RosterCell.tsx             # Day cell — drop zone, shows shifts
│   ├── ShiftBlock.tsx             # Draggable shift block with color, time, cost
│   ├── GhostShift.tsx             # Faded last-week shift overlay
│   ├── DayPartBands.tsx           # AM/Lunch/PM/Close background shading
│   ├── RoleGroupHeader.tsx        # Collapsible role section header with subtotals
│   ├── CostBar.tsx                # Sticky live cost bar (top/bottom)
│   ├── CostBarExpanded.tsx        # Expanded cost breakdown by role/daypart/person
│   ├── CoverageHeatmap.tsx        # Under/over-staffed visual indicator per daypart
│   ├── StaffSidebar.tsx           # Left sidebar: available staff, drag to assign
│   ├── StaffCard.tsx              # Individual staff card in sidebar (draggable)
│   ├── ShiftDetailPanel.tsx       # Right slide-out panel for shift details
│   ├── ComplianceSummary.tsx      # Compliance warnings panel
│   ├── ComplianceIcon.tsx         # Inline warning icon on shifts
│   ├── OpenShiftBanner.tsx        # Open/unassigned shifts row
│   ├── PublishDialog.tsx          # Publish confirmation + notification preview
│   ├── AutoFillDialog.tsx         # AI auto-fill settings and preview
│   ├── ShiftTemplateDialog.tsx    # Save/apply shift templates
│   └── SalesForecastOverlay.tsx   # Faint sales line graph behind grid
```

### useRosterStore.ts Schema

```typescript
interface RosterStore {
  // View state
  view: "week" | "day" | "fortnight";
  selectedDate: Date; // Monday of current week
  selectedDayIndex: number; // 0-6 for day view
  isDraft: boolean;

  // Data
  shifts: RosterShift[];
  ghostShifts: RosterShift[]; // last week's shifts
  staff: StaffMember[];
  availability: StaffAvailability[];
  templates: ShiftTemplate[];
  openShifts: RosterShift[];

  // Filters
  roleFilter: string | null;
  searchQuery: string;

  // UI state
  selectedShiftId: string | null; // for detail panel
  expandedRoles: Set<string>;
  costBarExpanded: boolean;
  sidebarOpen: boolean;

  // Computed (derived in selectors)
  // shiftsByStaffByDay, costByRole, costByDaypart, complianceWarnings, coverageByDaypart

  // Actions
  setView: (view: "week" | "day" | "fortnight") => void;
  navigateWeek: (direction: 1 | -1) => void;
  addShift: (shift: Partial<RosterShift>) => Promise<void>;
  updateShift: (id: string, updates: Partial<RosterShift>) => Promise<void>;
  moveShift: (id: string, newStaffId: string, newDate: Date) => Promise<void>;
  resizeShift: (id: string, newStart: Date, newEnd: Date) => Promise<void>;
  deleteShift: (id: string) => Promise<void>;
  publishRoster: (weekStart: Date) => Promise<void>;
  loadWeek: (weekStart: Date) => Promise<void>;
  selectShift: (id: string | null) => void;
  toggleRole: (role: string) => void;

  // Subscriptions
  subscribeToChanges: () => () => void; // returns unsubscribe
}
```

### Role Colors (consistent across app)

```typescript
const ROLE_COLORS = {
  kitchen: {
    bg: "bg-orange-100",
    border: "border-orange-300",
    text: "text-orange-800",
    dot: "bg-orange-500",
  },
  bar: {
    bg: "bg-purple-100",
    border: "border-purple-300",
    text: "text-purple-800",
    dot: "bg-purple-500",
  },
  foh: {
    bg: "bg-blue-100",
    border: "border-blue-300",
    text: "text-blue-800",
    dot: "bg-blue-500",
  },
  management: {
    bg: "bg-slate-100",
    border: "border-slate-300",
    text: "text-slate-800",
    dot: "bg-slate-500",
  },
  default: {
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-800",
    dot: "bg-gray-500",
  },
};
```

### Penalty Rate Visual Indicators

- Weekend shifts: subtle diagonal stripe pattern via CSS
- Evening (after 7pm): darker shade of role color
- Public holiday: gold/amber border

## Build Order (commit after each)

### Commit 1: Store + Grid Layout + Basic Rendering

- Create useRosterStore.ts with core state, load from Supabase
- Create RosterGrid with week view, role-grouped rows
- Create RosterHeader with view toggles and date navigation
- Create RosterRow, RosterCell, ShiftBlock (static, no drag yet)
- DayPartBands background shading (AM 6-11, Lunch 11-2, PM 2-6, Close 6-10)
- RoleGroupHeader with collapse/expand
- Replace Roster.tsx page with new version (move old to RosterLegacy.tsx)
- Mobile: day view on phone, week on tablet/desktop

### Commit 2: Drag and Drop

- Implement DnD context with @dnd-kit
- ShiftBlock becomes draggable
- RosterCell becomes droppable
- StaffSidebar with draggable StaffCards
- Drag staff from sidebar → grid to create shifts
- Drag shifts between cells to move
- Ghost shifts: load last week's shifts as faded overlay
- Visual feedback during drag (ghost, drop indicators)

### Commit 3: Live Cost Bar + Shift Detail Panel

- CostBar: sticky bar showing total $, labour %, vs budget, penalty breakdown
- CostBar updates reactively as shifts change
- CostBarExpanded: click to see by role, daypart, individual
- ShiftDetailPanel: right slide-out with full shift info
- Quick actions in panel: split, reassign, convert to open, add notes
- "This person's week" summary in panel

### Commit 4: Compliance Engine Integration

- Wire existing rosterCalculations.ts into store
- ComplianceIcon on each shift with violations
- ComplianceSummary panel showing all warnings
- Inline conflict detection: double-booking, max hours, breaks, minimum engagement
- CoverageHeatmap: under/over-staffed visual per daypart
- Penalty rate auto-calculation visible on shift blocks

### Commit 5: Publish Flow + Templates + Open Shifts

- Draft mode: unpublished shifts shown as faded/yellow
- PublishDialog: preview who gets notified, one-click publish
- Change tracking: modified shifts after publish shown with diff indicator
- ShiftTemplateDialog: save/apply patterns
- OpenShiftBanner: unassigned shifts row
- Auto-fill: basic version using last week as base + availability filter

### Commit 6: Connected Features

- SalesForecastOverlay: faint line graph from orders data
- Prep load indicator: based on recipe prep times × forecast
- Delivery awareness: show expected deliveries on timeline
- Supabase real-time subscription for live updates across devices

## Key Implementation Notes

1. **All DB writes: Supabase first → then update store** (project pattern)
2. **RLS**: All queries filter by org_id from auth context
3. **Existing tables**: Use `roster_shifts`, `staff`, `staff_availability`, `shift_templates`, `shift_swap_requests` — schema already exists
4. **Auth**: Import `useAuth` for currentOrg/currentVenue
5. **Mobile-first**: Use Tailwind responsive classes. Day view on `sm:`, week on `md:+`
6. **Don't touch other modules** — only modify files in pages/labour/Roster.tsx and components/roster/
7. **Import paths**: Use `@/` prefix (maps to src/)
8. **Formatting**: Use existing `formatCurrency` from `@/lib/utils/formatters`
9. **Types**: Use existing types from `@/types/index.ts` for Staff, RosterShift, etc.
10. **Keep dataStore usage minimal** — only for cross-module data (staff list). Roster data lives in rosterStore.
11. **Run `npx tsc --noEmit` after each commit** — zero errors required.

## Existing Types to Use (from src/types/index.ts)

- RosterShift, ShiftTemplate, Staff, StaffAvailability
- AU_HOSPITALITY_PENALTY_RATES (penalty rate constants)
- ShiftCostBreakdown

## Existing Utils to Use

- src/lib/utils/rosterCalculations.ts — calculateShiftCostBreakdown, calculatePenaltyRate, detectConflicts, etc.
- src/lib/utils/formatters.ts — formatCurrency
- src/contexts/AuthContext.tsx — useAuth() for currentOrg, currentVenue

When completely finished, run this command to notify me:
openclaw system event --text "Done: Roster redesign complete — 6 commits on feature/roster-redesign" --mode now
