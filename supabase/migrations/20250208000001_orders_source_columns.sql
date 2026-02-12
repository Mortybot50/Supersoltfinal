-- Add source tracking columns to orders table for POS sync dedup
-- These columns are nullable so existing rows are unaffected.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_data jsonb;

-- Index for dedup: fast lookup by source + external_id
CREATE INDEX IF NOT EXISTS idx_orders_external_id ON orders (external_id) WHERE external_id IS NOT NULL;

-- Unique constraint for POS dedup (prevent duplicate Square imports)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_source_external_id ON orders (source, external_id) WHERE external_id IS NOT NULL;
