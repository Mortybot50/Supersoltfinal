# SuperSolt Design System

## Page Layout Pattern

Every page MUST use `PageShell` + `PageToolbar` from `@/components/shared/`:

```tsx
import { PageShell } from "@/components/shared/PageShell"
import { PageToolbar } from "@/components/shared/PageToolbar"
import { PageSidebar } from "@/components/shared/PageSidebar"

export default function MyPage() {
  return (
    <PageShell
      toolbar={<PageToolbar title="Page Title" />}
      sidebar={<PageSidebar title="Stats" metrics={[...]} />}
    >
      <div className="p-6 space-y-6">
        {/* Page content */}
      </div>
    </PageShell>
  )
}
```

### Content Padding

- Standard content area: `p-6 space-y-6`
- Never use full-bleed content without padding
- All pages must have consistent left/right padding

### PageToolbar

- Use for page title, date navigation, filters, and primary actions
- Sticks to top of content area (non-scrolling)
- Props: `title`, `dateNavigation`, `filters`, `actions`, `primaryAction`

### PageSidebar (optional)

- Dark sidebar (`bg-slate-900`) on the left, 280px wide
- Use for stats, quick actions, warnings
- Hidden on mobile (`hidden lg:flex`)

## Date Picker Standard

Use `DateRangeSelector` from `@/components/DateRangeSelector.tsx` on ALL pages that display time-series data.

Features required:

- Period tabs: Day / Week / Month
- Navigation: Prev / Today / Next buttons
- Custom date range picker with calendar dialog
- Quick presets: Last 7 days, Last 30 days, Last 3 months, Year to date

Integrate into `PageToolbar` filters slot or place above content area consistently.

## Sidebar Navigation

- Located in `src/components/Layout.tsx`
- Nav config: `mainGroups` array + `settingsGroup`
- Accordion behavior: only ONE group open at a time
- Active route auto-expands its parent group
- Collapsed mode: flyout tooltips on hover

### Nav Group Structure

```ts
type NavGroup = {
  title: string;
  icon: LucideIcon;
  items: { title: string; url: string }[];
};
```

## Component Library

- UI primitives: shadcn/ui (Radix) in `src/components/ui/`
- Icons: lucide-react
- Charts: Recharts
- Forms: React Hook Form + Zod

## Color Tokens

- Brand primary: `brand-*` classes (blue-based)
- Success: `emerald-*` / `green-*`
- Warning: `orange-*` / `amber-*`
- Danger: `red-*` / `destructive`
- Neutral: `slate-*`
- Dark mode: all components support `dark:` variants

## Cards

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Optional subtitle</CardDescription>
  </CardHeader>
  <CardContent>{/* Content */}</CardContent>
</Card>
```

## KPI Cards Pattern (Dashboard)

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">Metric Name</CardTitle>
    <Icon className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    <p className="text-xs text-muted-foreground">
      {comparison text}
    </p>
  </CardContent>
</Card>
```

## Tables

Use shadcn Table components. For data-heavy tables, use TanStack Table.

- Always include empty states
- Sortable columns where applicable
- Pagination for lists > 20 items

## Empty States

Every page/section that depends on data must have an empty state:

```tsx
<div className="text-center py-12">
  <Icon className="mx-auto h-12 w-12 text-muted-foreground" />
  <h3 className="mt-2 text-sm font-semibold">No items yet</h3>
  <p className="mt-1 text-sm text-muted-foreground">
    Get started by creating your first item.
  </p>
  <Button className="mt-4" onClick={...}>
    <Plus className="h-4 w-4 mr-2" /> Add Item
  </Button>
</div>
```

## Dialogs & Modals

- Use shadcn `Dialog` for forms and confirmations
- Use `AlertDialog` for destructive actions (never `window.confirm()`)
- All dialogs must close on Escape key
- All dialogs must have Cancel + Confirm buttons

## Toast Notifications

Use shadcn `toast` for success/error feedback:

```tsx
import { toast } from "@/hooks/use-toast";
toast({ title: "Success", description: "Item saved" });
toast({
  title: "Error",
  description: "Failed to save",
  variant: "destructive",
});
```

## Responsive Breakpoints

- Mobile: < 768px (md)
- Tablet: 768px–1024px (lg)
- Desktop: > 1024px
- PageSidebar hidden below lg
- Main sidebar collapses on mobile (hamburger menu)

## Typography

- Page titles: `text-lg font-semibold` (in PageToolbar)
- Section headings: `text-base font-semibold`
- Card titles: `text-sm font-medium`
- Body: `text-sm`
- Captions: `text-xs text-muted-foreground`

## Hiding MVP-Deferred Features

When hiding a feature for MVP, do NOT delete the code. Instead:

1. Remove the sidebar nav link from `Layout.tsx` nav config
2. Add comment: `{/* Hidden for MVP */}` where the link was
3. Keep route definition (lazy-loaded) in router
4. Keep component files intact
