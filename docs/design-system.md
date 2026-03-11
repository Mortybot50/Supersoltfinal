# SuperSolt Design System

## Color System

### CSS Custom Properties (defined in index.css)

**Brand Identity** (logo, sidebar S icon, brand moments — NOT on buttons):
- `--brand`: #B8E636 (lime green)
- `--brand-hover`: #A5CC2E
- `--brand-muted`: rgba(184,230,54,0.15)

**Primary Action** (CTAs, active states, links, buttons):
- `--primary-action`: #14B8A6 (teal)
- `--primary-action-hover`: #0D9488
- `--primary-action-muted`: rgba(20,184,166,0.12)

**Dark Base** (sidebar, headings):
- `--dark`: #111111
- `--dark-secondary`: rgba(17,17,17,0.68)
- `--dark-tertiary`: rgba(17,17,17,0.54)
- `--dark-quaternary`: rgba(17,17,17,0.38)

**Surfaces**:
- `--surface-page`: #F9FAFB
- `--surface-card`: #FFFFFF
- `--surface-subtle`: #F3F4F6
- `--border-color`: #E5E7EB
- `--border-light`: #F3F4F6

**Status** (functional only, never decorative):
- `--success`: #10B981 / `--success-muted`: rgba(16,185,129,0.12)
- `--warning`: #F59E0B / `--warning-muted`: rgba(245,158,11,0.12)
- `--error`: #EF4444 / `--error-muted`: rgba(239,68,68,0.12)
- `--info`: #3B82F6 / `--info-muted`: rgba(59,130,246,0.12)

### Where each color goes:
- **Lime green (#B8E636)**: Logo mark, sidebar S icon, brand badge. NOT on buttons, NOT on form elements.
- **Teal (#14B8A6)**: All primary buttons, links, active nav items, active tab underlines, toggle-on states, progress bars, focus rings.
- **Dark (#111111)**: Sidebar background, page headings, primary text, card titles.
- **Status colors**: Only in badges, alerts, status indicators.

### Tailwind color aliases:
- `brand` — lime green (#B8E636) + shades 50–900
- `teal` — primary action (#14B8A6)

## Typography

Font: Inter (imported from Google Fonts). Fallback: system-ui, -apple-system, sans-serif.

| Usage | Size | Weight | Notes |
|---|---|---|---|
| Page title | 24px | 700 | |
| Section heading | 20px | 700 | |
| Subheading | 16px | 600 | |
| Body | 14px | 400 | |
| Small | 12px | 400 | |
| Table header | 12px | 600 | uppercase, 0.5px letter-spacing |

Only weights: 400 and 700 (600 sparingly for subheadings/table headers).

## Spacing (4px base)

| Token | Value |
|---|---|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |

- Card padding: 24px
- Grid gap: 24px
- Section spacing: 32px

## Shadows

- Cards: `0 1px 3px rgba(0,0,0,0.06)`
- Elevated (card hover): `0 2px 8px rgba(0,0,0,0.08)`
- Dropdowns: `0 4px 16px rgba(0,0,0,0.12)`

## Border Radius

- Buttons / inputs: 8px
- Avatars: 50%
- Badges: 12px (pill)
- Cards: 8px

## Transitions

`all 150ms cubic-bezier(0.4,0,0.2,1)` — used everywhere.

## Layout

### Dual Sidebar

**Icon Rail** (left, always visible):
- Width: 64px, fixed, background #111111
- Top: SuperSolt logo S in rounded square with lime green bg
- Icon-only nav buttons, Lucide 20px, rgba(255,255,255,0.5)
- Active icon: lime green bg pill (rounded-lg), icon white
- Hover: rgba(255,255,255,0.08) bg
- Bottom-pinned: Settings gear + user avatar (32px)

**Context Sidebar** (right of icon rail, collapsible):
- Width: 240px, collapsible to 0, background #FAFAFA
- Top: venue name + venue switcher
- Contextual sub-nav per active module
- State in localStorage key: `supersolt:context-sidebar-collapsed`

### Main content margin

- Desktop: margin-left = 64px + context-sidebar-width (240px or 0)
- Mobile (<768px): icon rail → bottom tab bar, context sidebar → slide-out drawer

## Page Layout Pattern

Every page MUST use `PageShell` + `PageToolbar` from `@/components/shared/`:

```tsx
import { PageShell } from "@/components/shared/PageShell"
import { PageToolbar } from "@/components/shared/PageToolbar"

export default function MyPage() {
  return (
    <PageShell toolbar={<PageToolbar title="Page Title" />}>
      <div className="p-6 space-y-6">
        {/* Page content */}
      </div>
    </PageShell>
  )
}
```

### Content Padding
- Standard: `p-6 space-y-6`
- Never use full-bleed without padding

### Dashboard / Reporting Page Structure (Three-layer hierarchy):
1. **KPI Strip** (top): 4–6 metric cards horizontal
2. **Contextual Visualization** (middle): charts, calendars
3. **Detail Table** (bottom): searchable, filterable, sortable

## Cards

```tsx
<Card className="ss-card">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

- White bg, 1px border (#E5E7EB), 8px radius, shadow `0 1px 3px rgba(0,0,0,0.06)`
- Padding: 24px
- Clickable hover: `0 2px 8px rgba(0,0,0,0.08)` + translateY(-1px)

### KPI Card Icon Colors (domain):
- Kitchen/Menu: orange #F97316
- Workforce: blue #3B82F6
- Financial: teal #14B8A6
- Inventory: purple #8B5CF6
- Compliance: slate #64748B

## Data Tables

- Header: 12px uppercase 0.5px letter-spacing, `--dark-tertiary` color, 600 weight, bottom border only
- Rows: 14px secondary color, min-height 56px, 16px vertical padding
- Zebra: alternate rows rgba(17,17,17,0.02)
- Hover: `--surface-subtle` bg
- Action buttons: icon-only (Pencil, Trash, MoreHorizontal), 32px tap targets, tooltips

## StatusBadge

Component: `src/components/shared/StatusBadge.tsx`

| Status group | Color |
|---|---|
| active, complete, approved, published, confirmed, delivered, received, adequate | success green |
| pending, draft, scheduled, invited | warning amber |
| cancelled, rejected, error, critical | error red |
| inactive, archived, closed | grey |
| in-progress, processing, submitted, info | info blue |
| overstocked, warning | orange |

Style: `px-2.5 py-0.5`, 12px border-radius (pill), 12px font, 600 weight, muted bg + solid color text.

## Tab Patterns

1. **Page-level tabs**: text with teal underline, 14px, 600 when active
2. **Data filter chips**: pill buttons, active=solid teal/white, inactive=subtle bg/tertiary
3. **Binary toggles**: segmented control, active=dark bg/white text

## Form Elements

- Inputs: 1px border (#E5E7EB), 8px radius, 10px 14px padding, 14px font
- Focus: teal border + 3px teal-muted ring
- Labels: 14px/600/dark, 6px margin-bottom
- Primary button: teal bg, white text, 10px 20px padding, 600 weight
- Secondary: border, white bg, dark text
- Destructive: error bg, white text
- Ghost: no border/bg, tertiary text, hover subtle bg

## Date Picker Standard

Use `DateRangeSelector` from `@/components/DateRangeSelector.tsx` on all time-series pages.

## Sidebar Navigation

Located in `src/components/Layout.tsx`, `src/components/IconRail.tsx`, `src/components/ContextSidebar.tsx`.

## Component Library

- UI primitives: shadcn/ui (Radix) in `src/components/ui/`
- Icons: lucide-react
- Charts: Recharts
- Forms: React Hook Form + Zod

## Dialogs & Modals

- Use shadcn `Dialog` for forms and confirmations
- Use `AlertDialog` for destructive actions (never `window.confirm()`)
- All dialogs must close on Escape key

## Toast Notifications

```tsx
import { toast } from "@/hooks/use-toast"
toast({ title: "Success", description: "Item saved" })
toast({ title: "Error", description: "Failed to save", variant: "destructive" })
```

## Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px–1024px
- Desktop: > 1024px

## Hiding MVP-Deferred Features

Do NOT delete code. Instead:
1. Remove the nav link from Layout.tsx nav config
2. Add comment: `{/* Hidden for MVP */}` where the link was
3. Keep route definition in router
4. Keep component files intact
