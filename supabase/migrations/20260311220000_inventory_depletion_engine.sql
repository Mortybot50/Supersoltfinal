-- ============================================================
-- Inventory Depletion Engine
-- Tables: square_catalog_mappings, square_modifier_mappings,
--         ingredient_waste_factors, stock_depletion_queue,
--         stock_movements, demand_forecasts
-- DB function: calculate_current_stock()
-- All tables: org_id scoped, full RLS policies
-- ============================================================

-- ── 1. square_catalog_mappings ────────────────────────────────
-- Links Square catalog item IDs to SuperSolt recipes.
-- org_id + venue_id scoped (venue_id nullable = applies to all venues in org).
-- Auto-populated by sync-catalog action; operators confirm/adjust matches.
CREATE TABLE IF NOT EXISTS square_catalog_mappings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id                UUID        REFERENCES venues(id) ON DELETE CASCADE,
  square_catalog_item_id  TEXT        NOT NULL,
  square_item_name        TEXT        NOT NULL,
  recipe_id               UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  is_active               BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One mapping per org + catalog item (Square item IDs are globally unique per merchant)
ALTER TABLE square_catalog_mappings
  ADD CONSTRAINT square_catalog_mappings_org_item_unique
  UNIQUE (org_id, square_catalog_item_id);

CREATE INDEX idx_square_catalog_mappings_org_venue
  ON square_catalog_mappings(org_id, venue_id)
  WHERE is_active = true;

-- RLS
ALTER TABLE square_catalog_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read square_catalog_mappings"
  ON square_catalog_mappings FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert square_catalog_mappings"
  ON square_catalog_mappings FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update square_catalog_mappings"
  ON square_catalog_mappings FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org admins can delete square_catalog_mappings"
  ON square_catalog_mappings FOR DELETE
  USING (is_org_admin(org_id));


-- ── 2. square_modifier_mappings ───────────────────────────────
-- Maps Square modifier option IDs to ingredient quantity adjustments.
-- e.g. "no cheese" → ingredient_id=cheese, quantity_adjustment=20, adjustment_type='remove'
-- e.g. "extra shot" → ingredient_id=espresso, quantity_adjustment=7, adjustment_type='add'
CREATE TABLE IF NOT EXISTS square_modifier_mappings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  square_modifier_id      TEXT        NOT NULL,
  square_modifier_name    TEXT        NOT NULL,
  ingredient_id           UUID        REFERENCES ingredients(id) ON DELETE SET NULL,
  quantity_adjustment     NUMERIC(10,4) NOT NULL DEFAULT 0,
  -- add = deduct more of this ingredient; remove = deduct less; replace = swap ingredient
  adjustment_type         TEXT        NOT NULL DEFAULT 'add'
                            CHECK (adjustment_type IN ('add', 'remove', 'replace')),
  unit                    TEXT        NOT NULL DEFAULT 'g',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE square_modifier_mappings
  ADD CONSTRAINT square_modifier_mappings_org_modifier_unique
  UNIQUE (org_id, square_modifier_id);

CREATE INDEX idx_square_modifier_mappings_org
  ON square_modifier_mappings(org_id);

-- RLS
ALTER TABLE square_modifier_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read square_modifier_mappings"
  ON square_modifier_mappings FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert square_modifier_mappings"
  ON square_modifier_mappings FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update square_modifier_mappings"
  ON square_modifier_mappings FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org admins can delete square_modifier_mappings"
  ON square_modifier_mappings FOR DELETE
  USING (is_org_admin(org_id));


-- ── 3. ingredient_waste_factors ───────────────────────────────
-- Per-venue, per-ingredient waste percentages by waste type.
-- Depletion engine multiplies theoretical usage by (1 + waste_percentage / 100).
-- Waste types: trim (prep), spillage, evaporation, overportioning.
CREATE TABLE IF NOT EXISTS ingredient_waste_factors (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id           UUID        REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id      UUID        NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  waste_percentage   NUMERIC(5,2) NOT NULL DEFAULT 0
                       CHECK (waste_percentage >= 0 AND waste_percentage <= 100),
  -- trim=prep/peeling, spillage=accidental loss, evaporation=cooking reduction, overportioning=portion inconsistency
  waste_type         TEXT        NOT NULL DEFAULT 'trim'
                       CHECK (waste_type IN ('trim', 'spillage', 'evaporation', 'overportioning')),
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredient_waste_factors_ingredient
  ON ingredient_waste_factors(org_id, venue_id, ingredient_id);

-- RLS
ALTER TABLE ingredient_waste_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read ingredient_waste_factors"
  ON ingredient_waste_factors FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert ingredient_waste_factors"
  ON ingredient_waste_factors FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update ingredient_waste_factors"
  ON ingredient_waste_factors FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org admins can delete ingredient_waste_factors"
  ON ingredient_waste_factors FOR DELETE
  USING (is_org_admin(org_id));


-- ── 4. stock_depletion_queue ──────────────────────────────────
-- Durable queue of Square order events awaiting depletion processing.
-- Written on webhook ingestion; processed by process-queue action.
-- Unique on (org_id, square_order_id) — idempotent against Square webhook retries.
--
-- line_items JSONB schema:
-- [{
--   catalog_item_id: string,
--   variation_id: string,
--   quantity: number,
--   modifiers: [{modifier_id: string, modifier_name: string}]
-- }]
CREATE TABLE IF NOT EXISTS stock_depletion_queue (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id          UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  square_order_id   TEXT        NOT NULL,
  line_items        JSONB       NOT NULL DEFAULT '[]',
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message     TEXT,
  retry_count       INTEGER     NOT NULL DEFAULT 0,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_depletion_queue
  ADD CONSTRAINT stock_depletion_queue_org_order_unique
  UNIQUE (org_id, square_order_id);

-- Partial index for fast pending/failed queue polling — excludes completed/skipped rows
CREATE INDEX idx_stock_depletion_queue_status
  ON stock_depletion_queue(org_id, status)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_stock_depletion_queue_venue_created
  ON stock_depletion_queue(venue_id, created_at DESC);

-- RLS
ALTER TABLE stock_depletion_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read stock_depletion_queue"
  ON stock_depletion_queue FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert stock_depletion_queue"
  ON stock_depletion_queue FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update stock_depletion_queue"
  ON stock_depletion_queue FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org admins can delete stock_depletion_queue"
  ON stock_depletion_queue FOR DELETE
  USING (is_org_admin(org_id));


-- ── 5. stock_movements ────────────────────────────────────────
-- Source of truth for all inventory movements. Append-only — never UPDATE or DELETE.
-- Stock level = last approved stock count + SUM(movements since count).
-- Positive quantity = adds to stock (purchase_receipt, opening_stock, refund_reversal, upward adjustment).
-- Negative quantity = removes from stock (sale_depletion, waste_log, downward adjustment).
--
-- unit_cost is recorded at time of movement for weighted-average COGS calculations.
-- reference_type/reference_id link back to the source record (order, PO, waste log, stock count).
CREATE TABLE IF NOT EXISTS stock_movements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id        UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id   UUID        NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type   TEXT        NOT NULL
                    CHECK (movement_type IN (
                      'sale_depletion',
                      'purchase_receipt',
                      'waste_log',
                      'stock_count_adjustment',
                      'manual_adjustment',
                      'refund_reversal',
                      'opening_stock'
                    )),
  -- positive = adds stock, negative = removes stock
  quantity        NUMERIC(12,4) NOT NULL,
  unit            TEXT          NOT NULL,
  -- unit cost at time of movement — used for weighted-average COGS
  unit_cost       NUMERIC(10,4),
  -- source record linkage
  reference_type  TEXT,  -- 'order' | 'purchase_order' | 'waste_log' | 'stock_count'
  reference_id    TEXT,  -- UUID of the referencing record (stored as TEXT for flexibility)
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primary query pattern: stock level for an ingredient at a venue, ordered by time
CREATE INDEX idx_stock_movements_ingredient
  ON stock_movements(venue_id, ingredient_id, created_at DESC);

-- Reference lookup: find all movements from a specific order or PO
CREATE INDEX idx_stock_movements_reference
  ON stock_movements(reference_type, reference_id);

CREATE INDEX idx_stock_movements_org_venue_type
  ON stock_movements(org_id, venue_id, movement_type, created_at DESC);

-- RLS — append-only: members can read, service role writes via process-queue handler.
-- No UPDATE or DELETE policies — data integrity is paramount.
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read stock_movements"
  ON stock_movements FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

-- INSERT is handled by service role (supabaseAdmin) in the API handler.
-- No client-side INSERT policy intentional — enforces all writes go through the API.


-- ── 6. demand_forecasts ───────────────────────────────────────
-- Output of Holt-Winters demand forecasting runs.
-- One row per (venue, menu_item, forecast_date). Upserted by run-forecast action.
-- confidence_lower/upper are ±1.5 × RMSE confidence bands (~85% coverage).
-- mape = Mean Absolute Percentage Error on last 7 days of actuals vs forecast (quality signal).
CREATE TABLE IF NOT EXISTS demand_forecasts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id           UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  menu_item_id       UUID        NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  forecast_date      DATE        NOT NULL,
  predicted_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  confidence_lower   NUMERIC(10,2) NOT NULL DEFAULT 0,
  confidence_upper   NUMERIC(10,2) NOT NULL DEFAULT 0,
  model_version      TEXT        NOT NULL DEFAULT 'holt_winters_v1',
  -- MAPE on last 7 days of actuals — quality signal (< 15% excellent, > 30% review)
  mape               NUMERIC(6,3),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE demand_forecasts
  ADD CONSTRAINT demand_forecasts_venue_item_date_unique
  UNIQUE (venue_id, menu_item_id, forecast_date);

CREATE INDEX idx_demand_forecasts_venue_date
  ON demand_forecasts(venue_id, forecast_date);

CREATE INDEX idx_demand_forecasts_item
  ON demand_forecasts(menu_item_id, forecast_date);

-- RLS
ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read demand_forecasts"
  ON demand_forecasts FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert demand_forecasts"
  ON demand_forecasts FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update demand_forecasts"
  ON demand_forecasts FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org admins can delete demand_forecasts"
  ON demand_forecasts FOR DELETE
  USING (is_org_admin(org_id));


-- ── DB function: calculate_current_stock ─────────────────────
-- Returns current stock for a given ingredient at a given venue.
-- Formula: last approved stock count quantity + sum of all movements after that count.
-- If no approved stock count exists, sums all movements from the beginning.
-- STABLE: same inputs return same result within a transaction (Postgres can cache).
-- SECURITY DEFINER: readable regardless of calling user's RLS context.
CREATE OR REPLACE FUNCTION calculate_current_stock(
  p_ingredient_id UUID,
  p_venue_id      UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_base_stock   NUMERIC   := 0;
  v_base_date    TIMESTAMPTZ := NULL;
  v_movements_sum NUMERIC  := 0;
BEGIN
  -- Find the most recent approved stock count for this ingredient at this venue.
  -- stock_count_items.actual_quantity is the verified physical count.
  SELECT sci.actual_quantity, sc.count_date::TIMESTAMPTZ
  INTO v_base_stock, v_base_date
  FROM stock_count_items sci
  JOIN stock_counts sc ON sc.id = sci.stock_count_id
  WHERE sci.ingredient_id = p_ingredient_id
    AND sc.venue_id        = p_venue_id
    AND sc.status          = 'approved'
  ORDER BY sc.count_date DESC
  LIMIT 1;

  -- Sum all stock movements after the base count date.
  -- If no approved count exists (v_base_date IS NULL), sum all movements ever.
  SELECT COALESCE(SUM(quantity), 0)
  INTO v_movements_sum
  FROM stock_movements
  WHERE ingredient_id = p_ingredient_id
    AND venue_id      = p_venue_id
    AND (v_base_date IS NULL OR created_at > v_base_date);

  RETURN COALESCE(v_base_stock, 0) + v_movements_sum;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users so the frontend can call it via RPC
GRANT EXECUTE ON FUNCTION calculate_current_stock(UUID, UUID) TO authenticated;

-- ── Updated_at triggers ───────────────────────────────────────
-- Reuse the existing moddatetime/update trigger pattern from other tables.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_square_catalog_mappings_updated_at
  BEFORE UPDATE ON square_catalog_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_square_modifier_mappings_updated_at
  BEFORE UPDATE ON square_modifier_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_ingredient_waste_factors_updated_at
  BEFORE UPDATE ON ingredient_waste_factors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
