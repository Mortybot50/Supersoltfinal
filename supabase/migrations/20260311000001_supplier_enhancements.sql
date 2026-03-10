-- Supplier enhancements: delivery schedules, HACCP, order channel
-- This migration adds new columns to the suppliers table.
-- DO NOT RUN until reviewed and approved.

-- New columns for enhanced supplier management
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS abn text,
  ADD COLUMN IF NOT EXISTS is_gst_registered boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_method text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS delivery_schedule jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule_overrides jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_order_channel text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS haccp_certified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_number text,
  ADD COLUMN IF NOT EXISTS certificate_expiry date;

-- delivery_schedule JSONB structure:
-- [
--   {
--     "day": 0-6 (0=Sunday),
--     "is_order_day": boolean,
--     "order_by_time": "HH:MM" or null,
--     "delivery_day": 0-6 or null
--   }
-- ]

-- schedule_overrides JSONB structure:
-- [
--   {
--     "id": "uuid",
--     "name": "text",
--     "start_date": "YYYY-MM-DD",
--     "end_date": "YYYY-MM-DD",
--     "note": "text"
--   }
-- ]

COMMENT ON COLUMN suppliers.delivery_schedule IS 'JSONB array of 7-day delivery schedule entries';
COMMENT ON COLUMN suppliers.schedule_overrides IS 'JSONB array of schedule override periods';
COMMENT ON COLUMN suppliers.preferred_order_channel IS 'Preferred order channel: email, phone, whatsapp, portal';
COMMENT ON COLUMN suppliers.haccp_certified IS 'Whether supplier is HACCP certified';
COMMENT ON COLUMN suppliers.certificate_number IS 'HACCP or food safety certificate number';
COMMENT ON COLUMN suppliers.certificate_expiry IS 'Certificate expiry date';
