-- ============================================
-- Migration: ingredient_price_history + allergens on ingredients
-- ============================================

-- 1. Create ingredient_price_history table
CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  old_cost_cents INTEGER,
  new_cost_cents INTEGER NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'invoice', 'import', 'bulk_update'))
);

CREATE INDEX idx_price_history_ingredient ON ingredient_price_history(ingredient_id, changed_at DESC);

-- RLS
ALTER TABLE ingredient_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price history for their org ingredients"
  ON ingredient_price_history FOR SELECT
  USING (
    ingredient_id IN (
      SELECT i.id FROM ingredients i
      JOIN venues v ON v.id = i.venue_id
      JOIN org_members om ON om.org_id = v.org_id AND om.user_id = auth.uid() AND om.is_active = true
    )
  );

CREATE POLICY "Users can insert price history for their org ingredients"
  ON ingredient_price_history FOR INSERT
  WITH CHECK (
    ingredient_id IN (
      SELECT i.id FROM ingredients i
      JOIN venues v ON v.id = i.venue_id
      JOIN org_members om ON om.org_id = v.org_id AND om.user_id = auth.uid() AND om.is_active = true
    )
  );

-- 2. Add allergens column to ingredients if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredients' AND column_name = 'allergens'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN allergens TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- 3. Add default_waste_percent column to ingredients if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ingredients' AND column_name = 'default_waste_percent'
  ) THEN
    ALTER TABLE ingredients ADD COLUMN default_waste_percent NUMERIC(5,2) DEFAULT 0;
  END IF;
END $$;
