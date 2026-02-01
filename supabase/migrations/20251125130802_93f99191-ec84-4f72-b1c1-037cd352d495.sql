-- Add new unit conversion columns to ingredients table
ALTER TABLE public.ingredients 
ADD COLUMN IF NOT EXISTS units_per_pack numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS unit_size numeric,
ADD COLUMN IF NOT EXISTS base_unit text,
ADD COLUMN IF NOT EXISTS pack_to_base_factor numeric,
ADD COLUMN IF NOT EXISTS unit_cost_ex_base numeric,
ADD COLUMN IF NOT EXISTS pack_size_text text;

-- Update existing records to have defaults
UPDATE public.ingredients
SET 
  units_per_pack = 1,
  unit_size = COALESCE(pack_size, 1),
  base_unit = CASE 
    WHEN unit IN ('g', 'kg') THEN 'g'
    WHEN unit IN ('mL', 'L') THEN 'mL'
    ELSE 'ea'
  END,
  pack_to_base_factor = CASE 
    WHEN unit = 'kg' THEN COALESCE(pack_size, 1) * 1000
    WHEN unit = 'L' THEN COALESCE(pack_size, 1) * 1000
    ELSE COALESCE(pack_size, 1)
  END,
  unit_cost_ex_base = CASE 
    WHEN unit = 'kg' THEN cost_per_unit::numeric / (COALESCE(pack_size, 1) * 1000)
    WHEN unit = 'L' THEN cost_per_unit::numeric / (COALESCE(pack_size, 1) * 1000)
    ELSE cost_per_unit::numeric / COALESCE(pack_size, 1)
  END,
  pack_size_text = CONCAT(
    CASE 
      WHEN pack_size = 1 OR pack_size IS NULL THEN '1'
      ELSE pack_size::text
    END,
    unit
  )
WHERE units_per_pack IS NULL;