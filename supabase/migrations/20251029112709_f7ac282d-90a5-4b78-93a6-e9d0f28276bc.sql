-- Create venue_settings table with inheritance support
CREATE TABLE IF NOT EXISTS public.venue_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL UNIQUE,
  
  -- Locale & Display
  timezone TEXT DEFAULT 'Australia/Melbourne',
  price_display_mode TEXT DEFAULT 'INC_GST',
  gst_rate_percent DECIMAL(5,2) DEFAULT 10.0,
  week_starts_on TEXT DEFAULT 'Monday',
  
  -- Menu & Pricing
  default_gp_target_percent DECIMAL(5,2) DEFAULT 70.0,
  menu_sections JSONB DEFAULT '[]'::jsonb,
  price_endings TEXT DEFAULT '.00',
  rounding_mode TEXT DEFAULT 'NEAREST',
  
  -- Suppliers & Ordering
  primary_suppliers JSONB DEFAULT '[]'::jsonb,
  delivery_windows JSONB DEFAULT '[]'::jsonb,
  order_cutoffs JSONB DEFAULT '[]'::jsonb,
  
  -- Workforce Defaults
  payroll_cycle TEXT DEFAULT 'Fortnightly',
  award_region TEXT DEFAULT 'VIC',
  roster_budget_percent DECIMAL(5,2) DEFAULT 25.0,
  
  -- POS & Printers
  pos_provider TEXT,
  printer_map JSONB DEFAULT '[]'::jsonb,
  tax_code_default TEXT,
  
  -- Holidays & Trading Calendar
  use_au_public_holidays BOOLEAN DEFAULT true,
  state TEXT DEFAULT 'VIC',
  custom_closed_dates JSONB DEFAULT '[]'::jsonb,
  
  -- Guardrails & Approvals
  price_change_max_percent_no_approval DECIMAL(5,2) DEFAULT 15.0,
  po_amount_over_requires_owner INTEGER DEFAULT 500000,
  below_gp_threshold_alert_percent DECIMAL(5,2) DEFAULT 60.0,
  
  -- Inheritance tracking (maps field names to true/false)
  inherit JSONB DEFAULT '{}'::jsonb,
  
  -- Publishing
  last_published_snapshot JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit table for tracking changes
CREATE TABLE IF NOT EXISTS public.venue_settings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_snapshot JSONB,
  after_snapshot JSONB,
  diff_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_settings_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for venue_settings
CREATE POLICY "Allow all operations on venue_settings"
  ON public.venue_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for venue_settings_audit
CREATE POLICY "Allow all operations on venue_settings_audit"
  ON public.venue_settings_audit
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger for venue_settings
CREATE TRIGGER update_venue_settings_updated_at
  BEFORE UPDATE ON public.venue_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add constraints
ALTER TABLE public.venue_settings
  ADD CONSTRAINT venue_settings_price_display_mode_check 
    CHECK (price_display_mode IN ('INC_GST', 'EX_GST'));

ALTER TABLE public.venue_settings
  ADD CONSTRAINT venue_settings_week_starts_on_check 
    CHECK (week_starts_on IN ('Monday', 'Sunday'));

ALTER TABLE public.venue_settings
  ADD CONSTRAINT venue_settings_price_endings_check 
    CHECK (price_endings IN ('.00', '.50', '.90', '.95', '.99'));

ALTER TABLE public.venue_settings
  ADD CONSTRAINT venue_settings_rounding_mode_check 
    CHECK (rounding_mode IN ('NEAREST', 'UP', 'DOWN'));

ALTER TABLE public.venue_settings
  ADD CONSTRAINT venue_settings_payroll_cycle_check 
    CHECK (payroll_cycle IN ('Weekly', 'Fortnightly', 'Monthly'));

ALTER TABLE public.venue_settings
  ADD CONSTRAINT venue_settings_state_check 
    CHECK (state IN ('VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'));

ALTER TABLE public.venue_settings
  ADD CONSTRAINT venue_settings_award_region_check 
    CHECK (award_region IN ('VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'));