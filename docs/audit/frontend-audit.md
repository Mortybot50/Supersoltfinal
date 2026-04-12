# Frontend Quality Audit — SuperSolt

**Date:** 2026-03-12
**Branch:** fix/skill-audit-sweep
**Skills used:** frontend-design, tailwind-design-system, web-design-guidelines (Vercel)

---

## Summary

| Severity | Count | Fixed | Documented |
| -------- | ----- | ----- | ---------- |
| High     | 3     | 3     | 0          |
| Medium   | 5     | 0     | 5          |
| Low      | 4     | 0     | 4          |

---

## HIGH

### H1 — Icon-only buttons missing `aria-label` (Rule A1)

- **Files:**
  - `src/components/Layout.tsx` lines 340, 352
  - `src/components/roster/RosterShiftCard.tsx` line 70
- **Issue:** Sidebar collapse/close buttons and shift action menu trigger had no `aria-label`. Screen readers announced them as "button" with no context.
- **Fix:** Added `aria-label="Expand/Collapse sidebar"`, `aria-label="Close menu"`, `aria-label="Shift actions"`. Added `aria-hidden="true"` to the decorative icons inside.
- **Status:** ✅ Fixed

### H2 — Tables missing `overflow-x-auto` wrapper (mobile responsiveness)

- **Files:**
  - `src/pages/People.tsx` line 334 — staff table with 7 columns
  - `src/pages/labour/Timesheets.tsx` line 295 — timesheet table with 9+ columns
- **Issue:** Wide tables with no horizontal scroll container. On mobile or narrow viewports, columns are cut off with no way to scroll.
- **Fix:** Wrapped both tables in `overflow-x-auto` container.
- **Status:** ✅ Fixed

### H3 — Decorative icons missing `aria-hidden="true"` inside interactive controls (Rule A6)

- **Files:** `src/components/Layout.tsx` lines 345, 347, 356
- **Issue:** `ChevronRight`, `ChevronLeft`, `X` icons inside buttons without `aria-hidden`. Screen readers read the SVG title alongside the button label.
- **Fix:** Added `aria-hidden="true"` to all decorative icons inside the Layout buttons.
- **Status:** ✅ Fixed

---

## MEDIUM

### M1 — Undersized touch targets `h-7` (28px) on action buttons (Rule TR)

- **Files:**
  - `src/pages/labour/Roster.tsx` lines ~137, 146, 157, 168 — toolbar buttons `h-7`
  - `src/pages/inventory/PurchaseOrders.tsx` lines ~549, 636 — inline row action buttons `h-7 w-7`
  - `src/components/roster/RosterShiftCard.tsx` line 73 — shift menu trigger `h-4 w-4` (16px!)
- **Issue:** Minimum recommended touch target is 44px. h-7 (28px) is below threshold. The roster shift card trigger at h-4 (16px) is severely undersized.
- **Note:** The RosterShiftCard button is intentionally compact for the dense calendar grid. The h-4 trigger is a design trade-off for the roster density.
- **Status:** ⚠️ Documented — roster toolbar buttons should be increased to `h-9` minimum; tracked as UX debt

### M2 — Missing loading skeletons on Ingredients and Roster pages

- **Files:**
  - `src/pages/Ingredients.tsx` — `isLoading` state exists but no skeleton shown; page renders empty table
  - `src/pages/labour/Roster.tsx` — no loading indicator while shifts load
- **Issue:** Users see a blank/empty state before data loads instead of a skeleton. This can feel like a bug or empty data.
- **Status:** ⚠️ Documented — low complexity to add `if (isLoading) return <SkeletonTable />`

### M3 — `font-variant-numeric: tabular-nums` missing on number columns (Rule T5)

- **Scope:** Timesheets table (hours, cost columns), roster cost breakdown, payroll tables
- **Issue:** Number columns don't use tabular figures. Numbers in aligned columns will have inconsistent width (e.g., "1" vs "8" render at different widths), making scanning harder.
- **Fix (low effort):** Add `tabular-nums` Tailwind class to number cells: `<TableCell className="tabular-nums">$14.50</TableCell>`
- **Status:** ⚠️ Documented — systemic but low-effort fix

### M4 — `text-wrap: balance` missing on page headings (Rule T6)

- **Scope:** CardTitle components, section headings across multiple pages
- **Issue:** Long headings can break at awkward points. `text-wrap: balance` distributes line breaks more evenly.
- **Fix:** Add `text-balance` Tailwind class to `CardTitle` and `PageShell` heading elements.
- **Status:** ⚠️ Documented — cosmetic improvement

### M5 — Roster empty state not shown when no shifts exist

- **File:** `src/pages/labour/Roster.tsx`
- **Issue:** When the week has no shifts, the roster renders an empty grid without any guidance for the user. No "Add your first shift" prompt.
- **Status:** ⚠️ Documented — medium complexity; requires roster grid to detect empty state per week

---

## LOW

### L1 — No `prefers-reduced-motion` guard on roster DnD animations (Rule AN1)

- **File:** `src/components/roster/RosterDndWrapper.tsx`
- **Issue:** Drag-and-drop translate animations are not gated on `prefers-reduced-motion`.
- **Status:** ⚠️ Documented — @dnd-kit handles this via its own configuration

### L2 — No `autocomplete` attributes on staff form fields (Rule FM1)

- **File:** `src/components/StaffDialog.tsx`
- **Issue:** Name, email, phone inputs lack `autocomplete` attributes. Browsers can't assist with autofill.
- **Status:** ⚠️ Low priority for internal form

### L3 — Semantic heading hierarchy not enforced consistently

- **Scope:** Some pages use `<h3>` as the first heading element inside a Card (via CardTitle) when `<h2>` would be more correct.
- **Issue:** Minor heading hierarchy issue; not critical for this SPA.
- **Status:** ⚠️ Documented

### L4 — Toast notifications not using `aria-live` region (Rule A7)

- **Issue:** Sonner toasts inject into the DOM dynamically. Without `role="status"` or `aria-live="polite"` on the container, screen readers may miss toast messages.
- **Note:** Sonner 1.x does include accessible announcements — this is acceptable with current version.
- **Status:** ⚠️ Acceptable — Sonner handles this internally

---

## Consistency Notes

- **Toast system:** 100% using `sonner` — no legacy `useToast` calls found. ✅
- **Color system:** Consistent use of semantic tokens (`text-muted-foreground`, `bg-card`, etc.) — no hardcoded colors in page components. ✅
- **Empty states:** People.tsx and PurchaseOrders.tsx implement proper EmptyState patterns. ✅
- **Form labels:** All form inputs use either `react-hook-form FormLabel` (auto-links via htmlFor) or explicit `Label htmlFor` — no orphaned labels. ✅
- **Button variants:** Consistent use of `variant="ghost"`, `variant="outline"`, `variant="destructive"` across all pages. ✅
