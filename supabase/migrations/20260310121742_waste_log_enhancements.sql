-- Waste log enhancements: reason_code, daypart, photo_url, cost_at_time
-- This migration adds columns for richer waste tracking.
-- DO NOT RUN AUTOMATICALLY — review and apply manually.

-- Add reason_code (normalized enum-like text, replaces free-form reason over time)
ALTER TABLE waste_logs
  ADD COLUMN IF NOT EXISTS reason_code text;

-- Add daypart for shift-based waste analysis
ALTER TABLE waste_logs
  ADD COLUMN IF NOT EXISTS daypart text;

-- Add photo_url for waste evidence photos stored in Supabase Storage
ALTER TABLE waste_logs
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Add cost_at_time to snapshot the ingredient cost at the time of waste logging
-- Stored in cents (integer) to match existing value/cost conventions
ALTER TABLE waste_logs
  ADD COLUMN IF NOT EXISTS cost_at_time integer;

-- Backfill reason_code from existing reason column where possible
UPDATE waste_logs
  SET reason_code = reason
  WHERE reason_code IS NULL AND reason IS NOT NULL;

-- Add index for common query patterns
CREATE INDEX IF NOT EXISTS idx_waste_logs_venue_date
  ON waste_logs (venue_id, waste_date DESC);

CREATE INDEX IF NOT EXISTS idx_waste_logs_reason_code
  ON waste_logs (reason_code)
  WHERE reason_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waste_logs_daypart
  ON waste_logs (daypart)
  WHERE daypart IS NOT NULL;

-- Create storage bucket for waste photos (run via Supabase dashboard or CLI)
-- INSERT INTO storage.buckets (id, name, public)
--   VALUES ('waste-photos', 'waste-photos', false)
--   ON CONFLICT (id) DO NOTHING;

-- RLS policy for waste-photos bucket (apply via dashboard):
-- CREATE POLICY "Org members can upload waste photos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'waste-photos' AND auth.role() = 'authenticated');
-- CREATE POLICY "Org members can view waste photos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'waste-photos' AND auth.role() = 'authenticated');
