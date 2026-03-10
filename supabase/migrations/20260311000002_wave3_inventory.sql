-- Wave 3 Inventory Additions
-- Feature 2C: PO Receiving Workflow — track received_by_name and per-item notes

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS received_by_name text;

-- purchase_order_items already has a `notes` column from initial schema;
-- nothing to add there — we'll reuse it for receiving discrepancy notes.

-- Feature 3C: Price tracking — ingredient_price_history already exists.
-- No new tables needed: uses existing ingredient_price_history + supplier data.
