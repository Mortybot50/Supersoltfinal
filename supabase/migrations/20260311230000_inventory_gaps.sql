-- ============================================================
-- Inventory Engine Gap Closures
-- GAP 1: Reversal tracking on stock_depletion_queue
-- GAP 3: Actual quantity tracking on demand_forecasts
-- GAP 4: Supplier lead time learning — audit log table
-- ============================================================

-- ── GAP 1: Refund/void reversal columns ───────────────────────────────
-- reversed_at: timestamp when the depletion was reversed (refund/cancel)
-- reversal_reason: human-readable reason (e.g. "order_canceled", "refund_created")
ALTER TABLE stock_depletion_queue
  ADD COLUMN IF NOT EXISTS reversed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;


-- ── GAP 3: Actual quantity tracking on demand_forecasts ───────────────
-- actual_quantity: real sales count recorded after the forecast_date passes.
-- Populated by update-forecast-accuracy API action.
-- Used to compute true out-of-sample MAPE (actual vs predicted).
ALTER TABLE demand_forecasts
  ADD COLUMN IF NOT EXISTS actual_quantity NUMERIC(10,2);


-- ── GAP 4: Supplier lead time learning ───────────────────────────────
-- Records the actual delivery lead time for each PO receipt.
-- Used to compute a rolling average that replaces the static delivery_lead_days
-- in the reorder engine after ≥ 3 deliveries.
CREATE TABLE IF NOT EXISTS supplier_lead_time_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id         UUID        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_order_id   UUID        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  submitted_at        TIMESTAMPTZ NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL,
  -- Actual lead time in calendar days (fractional allowed for same-day deliveries)
  actual_lead_days    NUMERIC(6,2) NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Most common query: last N deliveries for a supplier to compute rolling average
CREATE INDEX idx_supplier_lead_time_logs_supplier
  ON supplier_lead_time_logs(org_id, supplier_id, received_at DESC);

-- Allow reverse lookup by PO (prevent double-logging on idempotent receives)
CREATE UNIQUE INDEX idx_supplier_lead_time_logs_po
  ON supplier_lead_time_logs(purchase_order_id);

-- RLS: org members can read, org admins can write (via API or direct)
ALTER TABLE supplier_lead_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read supplier_lead_time_logs"
  ON supplier_lead_time_logs FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert supplier_lead_time_logs"
  ON supplier_lead_time_logs FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update supplier_lead_time_logs"
  ON supplier_lead_time_logs FOR UPDATE
  USING (is_org_admin(org_id));
