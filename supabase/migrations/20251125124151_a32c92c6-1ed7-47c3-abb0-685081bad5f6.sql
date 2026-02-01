-- Change pack_size from integer to numeric to support decimal pack sizes (e.g., 1.5kg, 0.33L)
ALTER TABLE public.ingredients 
ALTER COLUMN pack_size TYPE numeric USING pack_size::numeric;