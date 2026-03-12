# TODO / FIXME Tracker

Consolidated list of deferred work items. Add new items here rather than leaving TODOs in source.

---

## Inbound Email Pipeline
**File:** `src/lib/services/emailIngestion.ts`

Connect email ingestion to a real inbound email provider (e.g. SendGrid Inbound Parse,
Postmark, or a dedicated `@invoices.supersolt.app` address). Currently the service is a
stub — `processInboundEmail()` does nothing.

Full pipeline to implement in `processInboundEmail()`:
1. `matchSenderToSupplier` → get `supplier_id`
2. For each PDF/image attachment: call `parseInvoice()`
3. Run `matchLineItems()` on extracted line items
4. Insert invoice + line items via `addInvoice()`
5. Notify venue staff via real-time channel

The webhook endpoint stub lives at `api/inbound-email/index.ts`.

---

## Roster — Create Leave from Shift Context Menu
**File:** `src/components/roster/ShiftContextMenu.tsx` (line ~153)

"Create Leave" menu item needs to open the leave dialog pre-filled with the shift's
staff member and date. Currently the click handler is a no-op.

---

## OrgSettings — Address Column
**File:** `src/pages/admin/OrgSettings.tsx` (line ~359)

Add an `address` column to the `organizations` table. Currently the street address is
stored in the `settings` JSON blob as a workaround. Requires a migration.

---

## Daybook — AI Prep Lists
**File:** `src/pages/operations/Daybook.tsx` (line ~411)

AI-generated prep list suggestions based on forecasted sales (key product differentiator).
Placeholder card is shown in the UI. Needs integration with the demand forecast engine
(`src/lib/services/forecastEngine.ts`) once that data is reliable.
