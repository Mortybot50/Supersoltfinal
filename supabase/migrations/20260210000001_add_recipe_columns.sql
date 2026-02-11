-- Add missing columns to recipes table for app compatibility
-- gp_target_percent: Gross profit target percentage (default 65%)
-- suggested_price: Computed selling price based on GP target (in cents)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'gp_target_percent') THEN
    ALTER TABLE recipes ADD COLUMN gp_target_percent DECIMAL(5,2) DEFAULT 65;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'suggested_price') THEN
    ALTER TABLE recipes ADD COLUMN suggested_price INTEGER DEFAULT 0;
  END IF;
END $$;
