-- Migration: Create all missing tables for SuperSolt
-- Generated: 2026-02-24
-- Tables: profiles, staff, timesheets, roster_shifts, menu_sections,
--         staff_availability, labor_budgets, shift_templates, recipes,
--         recipe_ingredients, shift_swap_requests, pos_connections,
--         pos_location_mappings, daybook_entries, venue_access, ingredient_price_history

-- ============================================================
-- 1. PROFILES (references auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Org members can view peer profiles"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT om2.user_id FROM org_members om2
      WHERE om2.org_id IN (
        SELECT om1.org_id FROM org_members om1 WHERE om1.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 2. VENUE_ACCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS venue_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id uuid NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_venue_access_org_member ON venue_access(org_member_id);
CREATE INDEX idx_venue_access_venue ON venue_access(venue_id);

ALTER TABLE venue_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view venue_access in their org"
  ON venue_access FOR SELECT
  USING (
    org_member_id IN (
      SELECT id FROM org_members WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can manage venue_access"
  ON venue_access FOR ALL
  USING (
    org_member_id IN (
      SELECT id FROM org_members WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- ============================================================
-- 3. STAFF
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id uuid NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  employment_type text NOT NULL DEFAULT 'casual',
  position text,
  base_hourly_rate numeric,
  award_classification text,
  start_date date,
  end_date date,
  onboarding_status text NOT NULL DEFAULT 'pending',
  date_of_birth date,
  gender text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  tfn_provided boolean DEFAULT false,
  tfn_declaration_date date,
  super_fund_name text,
  super_fund_abn text,
  super_member_number text,
  bank_bsb text,
  bank_account_number text,
  bank_account_name text,
  id_verified boolean DEFAULT false,
  contract_signed boolean DEFAULT false,
  contract_signed_at timestamptz,
  fwis_acknowledged boolean DEFAULT false,
  fwis_acknowledged_at timestamptz,
  policies_acknowledged boolean DEFAULT false,
  policies_acknowledged_at timestamptz,
  pin_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_org_member ON staff(org_member_id);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view staff in their org"
  ON staff FOR SELECT
  USING (
    org_member_id IN (
      SELECT id FROM org_members WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can manage staff"
  ON staff FOR ALL
  USING (
    org_member_id IN (
      SELECT id FROM org_members WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- ============================================================
-- 4. STAFF_AVAILABILITY
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  start_time time,
  end_time time,
  is_available boolean DEFAULT true,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_availability_staff ON staff_availability(staff_id);

ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view staff availability"
  ON staff_availability FOR SELECT
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON s.org_member_id = om.id
      WHERE om.org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can manage own availability"
  ON staff_availability FOR ALL
  USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON s.org_member_id = om.id
      WHERE om.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. SHIFT_TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text NOT NULL DEFAULT '',
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_minutes integer,
  days_of_week integer[],
  description text,
  is_active boolean DEFAULT true,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shift_templates_org ON shift_templates(org_id);
CREATE INDEX idx_shift_templates_venue ON shift_templates(venue_id);

ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view shift templates"
  ON shift_templates FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage shift templates"
  ON shift_templates FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')));

-- ============================================================
-- 6. ROSTER_SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS roster_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  position text,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  break_duration_mins integer,
  is_open_shift boolean DEFAULT false,
  template_id uuid REFERENCES shift_templates(id),
  published_at timestamptz,
  confirmed_at timestamptz,
  hourly_rate numeric,
  base_cost numeric,
  penalty_rate numeric,
  penalty_cost numeric,
  penalty_type text,
  estimated_cost numeric,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_roster_shifts_org ON roster_shifts(org_id);
CREATE INDEX idx_roster_shifts_venue ON roster_shifts(venue_id);
CREATE INDEX idx_roster_shifts_staff ON roster_shifts(staff_id);
CREATE INDEX idx_roster_shifts_date ON roster_shifts(shift_date);
CREATE INDEX idx_roster_shifts_created_at ON roster_shifts(created_at);

ALTER TABLE roster_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view roster shifts"
  ON roster_shifts FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage roster shifts"
  ON roster_shifts FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'supervisor')));

-- ============================================================
-- 7. TIMESHEETS
-- ============================================================
CREATE TABLE IF NOT EXISTS timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  roster_shift_id uuid REFERENCES roster_shifts(id),
  work_date date NOT NULL,
  clock_in timestamptz NOT NULL,
  clock_out timestamptz,
  clock_in_method text,
  clock_in_lat numeric,
  clock_in_lng numeric,
  clock_out_lat numeric,
  clock_out_lng numeric,
  break_start timestamptz,
  break_end timestamptz,
  total_break_mins numeric,
  total_hours numeric,
  overtime_hours numeric,
  hourly_rate numeric,
  penalty_rate numeric,
  total_pay numeric,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  edited boolean DEFAULT false,
  edit_reason text,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_timesheets_org ON timesheets(org_id);
CREATE INDEX idx_timesheets_venue ON timesheets(venue_id);
CREATE INDEX idx_timesheets_staff ON timesheets(staff_id);
CREATE INDEX idx_timesheets_work_date ON timesheets(work_date);
CREATE INDEX idx_timesheets_created_at ON timesheets(created_at);

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view timesheets"
  ON timesheets FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Staff can insert own timesheets"
  ON timesheets FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage all timesheets"
  ON timesheets FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'supervisor')));

-- ============================================================
-- 8. LABOR_BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS labor_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  period_type text NOT NULL DEFAULT 'weekly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  budgeted_amount numeric NOT NULL DEFAULT 0,
  actual_amount numeric,
  revenue_target numeric,
  warning_threshold_percent numeric,
  critical_threshold_percent numeric,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_labor_budgets_org ON labor_budgets(org_id);
CREATE INDEX idx_labor_budgets_venue ON labor_budgets(venue_id);

ALTER TABLE labor_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view labor budgets"
  ON labor_budgets FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage labor budgets"
  ON labor_budgets FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')));

-- ============================================================
-- 9. SHIFT_SWAP_REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  original_shift_id uuid NOT NULL REFERENCES roster_shifts(id) ON DELETE CASCADE,
  original_staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  target_staff_id uuid REFERENCES staff(id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shift_swap_org ON shift_swap_requests(org_id);
CREATE INDEX idx_shift_swap_venue ON shift_swap_requests(venue_id);

ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view swap requests"
  ON shift_swap_requests FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Staff can create swap requests"
  ON shift_swap_requests FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage swap requests"
  ON shift_swap_requests FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'supervisor')));

-- ============================================================
-- 10. MENU_SECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_sections_org ON menu_sections(org_id);

ALTER TABLE menu_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view menu sections"
  ON menu_sections FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage menu sections"
  ON menu_sections FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')));

-- ============================================================
-- 11. RECIPES
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'main',
  code text,
  status text NOT NULL DEFAULT 'draft',
  batch_yield numeric NOT NULL DEFAULT 1,
  serve_size numeric,
  serve_unit text,
  prep_time_mins integer,
  cook_time_mins integer,
  method text,
  image_url text,
  allergens text[],
  cost_per_batch numeric,
  cost_per_serve numeric,
  gp_target_percent numeric,
  suggested_price numeric,
  waste_percent numeric,
  version integer DEFAULT 1,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_org ON recipes(org_id);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view recipes"
  ON recipes FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage recipes"
  ON recipes FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')));

-- ============================================================
-- 12. RECIPE_INGREDIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  cost numeric,
  sort_order integer,
  notes text,
  is_sub_recipe boolean DEFAULT false,
  sub_recipe_id uuid REFERENCES recipes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view recipe ingredients"
  ON recipe_ingredients FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can manage recipe ingredients"
  ON recipe_ingredients FOR ALL
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- ============================================================
-- 13. POS_CONNECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS pos_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'square',
  merchant_id text,
  merchant_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  last_sync_status text,
  sync_frequency text,
  sync_from_date date,
  connected_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_connections_org ON pos_connections(org_id);

ALTER TABLE pos_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view pos connections"
  ON pos_connections FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage pos connections"
  ON pos_connections FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')));

-- ============================================================
-- 14. POS_LOCATION_MAPPINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS pos_location_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_connection_id uuid NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  pos_location_id text NOT NULL,
  pos_location_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pos_location_mappings_connection ON pos_location_mappings(pos_connection_id);
CREATE INDEX idx_pos_location_mappings_venue ON pos_location_mappings(venue_id);

ALTER TABLE pos_location_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view pos location mappings"
  ON pos_location_mappings FOR SELECT
  USING (
    pos_connection_id IN (
      SELECT id FROM pos_connections WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can manage pos location mappings"
  ON pos_location_mappings FOR ALL
  USING (
    pos_connection_id IN (
      SELECT id FROM pos_connections WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
      )
    )
  );

-- ============================================================
-- 15. DAYBOOK_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS daybook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  pos_sales numeric,
  cash_counted numeric,
  card_total numeric,
  variance numeric,
  notes text,
  issues text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_daybook_entries_org ON daybook_entries(org_id);
CREATE INDEX idx_daybook_entries_venue ON daybook_entries(venue_id);
CREATE INDEX idx_daybook_entries_date ON daybook_entries(entry_date);

ALTER TABLE daybook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view daybook entries"
  ON daybook_entries FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage daybook entries"
  ON daybook_entries FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'supervisor')));

-- ============================================================
-- 16. INGREDIENT_PRICE_HISTORY (derived from costCascade.ts code)
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  old_cost_cents integer,
  new_cost_cents integer NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredient_price_history_ingredient ON ingredient_price_history(ingredient_id);
CREATE INDEX idx_ingredient_price_history_changed_at ON ingredient_price_history(changed_at);

ALTER TABLE ingredient_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view ingredient price history"
  ON ingredient_price_history FOR SELECT
  USING (
    ingredient_id IN (
      SELECT id FROM ingredients WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can insert ingredient price history"
  ON ingredient_price_history FOR INSERT
  WITH CHECK (
    ingredient_id IN (
      SELECT id FROM ingredients WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  );
