-- ============================================================
-- CONSOLIDATED BASELINE MIGRATION
-- SuperSolt — Multi-venue restaurant ops SaaS
-- ============================================================
-- This file creates the complete schema from scratch on an empty
-- public schema. It is idempotent: safe to run multiple times.
--
-- All individual migrations in this directory represent the
-- incremental history. This baseline is for:
--   1. Fresh environment setup (CI, staging, new dev machines)
--   2. Disaster recovery on a blank Supabase project
--
-- RLS policies reflect the final audited state (as of 2026-03-12),
-- including all fixes from the platform audit (PRs #56, #57).
--
-- DO NOT run this on an existing populated database — use the
-- incremental migrations instead.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
-- uuid-ossp is available by default in Supabase
-- pgcrypto is available by default in Supabase

-- ── Helper functions (must exist before RLS policies) ────────

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND role IN ('owner', 'manager')
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calculate_menu_item_gp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sell_price > 0 AND NEW.cost_per_serve > 0 THEN
    NEW.gp_percent := (NEW.sell_price - NEW.cost_per_serve) / NEW.sell_price;
  ELSE
    NEW.gp_percent := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_current_stock(
  p_ingredient_id UUID,
  p_venue_id      UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_base_stock    NUMERIC     := 0;
  v_base_date     TIMESTAMPTZ := NULL;
  v_movements_sum NUMERIC     := 0;
BEGIN
  SELECT sci.counted_qty, sc.count_date::TIMESTAMPTZ
  INTO v_base_stock, v_base_date
  FROM stock_count_items sci
  JOIN stock_counts sc ON sc.id = sci.stock_count_id
  WHERE sci.ingredient_id = p_ingredient_id
    AND sc.venue_id        = p_venue_id
    AND sc.status          = 'approved'
  ORDER BY sc.count_date DESC
  LIMIT 1;

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_movements_sum
  FROM stock_movements
  WHERE ingredient_id = p_ingredient_id
    AND venue_id      = p_venue_id
    AND (v_base_date IS NULL OR created_at > v_base_date);

  RETURN COALESCE(v_base_stock, 0) + v_movements_sum;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════
-- TABLES (dependency order)
-- ════════════════════════════════════════════════════════════

-- ── 1. organizations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  abn              TEXT,
  legal_name       TEXT,
  phone            TEXT,
  email            TEXT,
  website          TEXT,
  logo_url         TEXT,
  timezone         TEXT        NOT NULL DEFAULT 'Australia/Melbourne',
  currency         TEXT        NOT NULL DEFAULT 'AUD',
  week_starts_on   INTEGER     NOT NULL DEFAULT 1,
  gst_registered   BOOLEAN     NOT NULL DEFAULT true,
  gst_rate         DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  default_gp_target DECIMAL(5,4) NOT NULL DEFAULT 0.65,
  pricing_mode     TEXT        NOT NULL DEFAULT 'gst_inclusive'
                     CHECK (pricing_mode IN ('gst_inclusive', 'gst_exclusive')),
  settings         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID
);

-- ── 2. venues ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  venue_type       TEXT        NOT NULL DEFAULT 'restaurant'
                     CHECK (venue_type IN ('restaurant','cafe','bar','food_truck','catering','other')),
  address          TEXT,
  address_line1    TEXT,
  address_line2    TEXT,
  suburb           TEXT,
  state            TEXT,
  postcode         TEXT,
  country          TEXT        DEFAULT 'Australia',
  phone            TEXT,
  email            TEXT,
  timezone         TEXT        NOT NULL DEFAULT 'Australia/Melbourne',
  trading_hours    JSONB,
  gst_registered   BOOLEAN,
  default_gp_target DECIMAL(5,4),
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID
);

CREATE INDEX IF NOT EXISTS idx_venues_org ON venues(org_id);

-- ── 3. profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  first_name TEXT,
  last_name  TEXT,
  phone      TEXT,
  avatar_url TEXT,
  timezone   TEXT DEFAULT 'Australia/Melbourne',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. org_members ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'crew'
               CHECK (role IN ('owner','manager','supervisor','crew','admin')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  joined_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org  ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

-- ── 5. venue_access ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venue_access (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id  UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  venue_id       UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  can_view       BOOLEAN NOT NULL DEFAULT true,
  can_edit       BOOLEAN NOT NULL DEFAULT false,
  role_override  TEXT CHECK (role_override IN ('manager','supervisor','crew')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_member_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_access_org_member ON venue_access(org_member_id);
CREATE INDEX IF NOT EXISTS idx_venue_access_venue      ON venue_access(venue_id);

-- ── 6. suppliers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  code                     TEXT,
  abn                      TEXT,
  is_gst_registered        BOOLEAN     DEFAULT true,
  contact_name             TEXT,
  phone                    TEXT,
  email                    TEXT,
  website                  TEXT,
  address_line1            TEXT,
  address_line2            TEXT,
  suburb                   TEXT,
  state                    TEXT,
  postcode                 TEXT,
  payment_terms            TEXT        DEFAULT 'net_30'
                             CHECK (payment_terms IN ('cod','net_7','net_14','net_30','net_60','eom')),
  credit_limit             DECIMAL(12,2),
  order_channel            TEXT        DEFAULT 'email'
                             CHECK (order_channel IN ('email','phone','portal','app','other')),
  order_email              TEXT,
  order_phone              TEXT,
  order_method             TEXT        DEFAULT 'email',
  preferred_order_channel  TEXT        DEFAULT 'email',
  min_order_value          DECIMAL(12,2),
  lead_time_days           INTEGER     DEFAULT 1,
  delivery_days            JSONB,
  delivery_schedule        JSONB       DEFAULT '[]',
  schedule_overrides       JSONB       DEFAULT '[]',
  haccp_certified          BOOLEAN     DEFAULT false,
  certificate_number       TEXT,
  certificate_expiry       DATE,
  invoice_email_domains    TEXT[],
  is_active                BOOLEAN     NOT NULL DEFAULT true,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id);

-- ── 7. ingredients ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           UUID        REFERENCES suppliers(id) ON DELETE SET NULL,
  name                  TEXT        NOT NULL,
  sku                   TEXT,
  supplier_code         TEXT,
  barcode               TEXT,
  category              TEXT        NOT NULL DEFAULT 'other'
                          CHECK (category IN ('meat','seafood','dairy','produce','dry_goods','beverages','alcohol','packaging','cleaning','other')),
  subcategory           TEXT,
  purchase_unit         TEXT        NOT NULL DEFAULT 'each',
  purchase_unit_qty     DECIMAL(10,4) DEFAULT 1,
  recipe_unit           TEXT        NOT NULL DEFAULT 'g',
  conversion_factor     DECIMAL(12,6) DEFAULT 1,
  unit_cost             DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_gst_free           BOOLEAN     DEFAULT false,
  last_cost_update      TIMESTAMPTZ,
  track_inventory       BOOLEAN     DEFAULT true,
  par_level             DECIMAL(12,4),
  reorder_qty           DECIMAL(12,4),
  default_waste_percent DECIMAL(5,4) DEFAULT 0,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  allergens             TEXT[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID
);

CREATE INDEX IF NOT EXISTS idx_ingredients_org      ON ingredients(org_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier ON ingredients(supplier_id);

-- ── 8. ingredient_price_history ──────────────────────────────
CREATE TABLE IF NOT EXISTS ingredient_price_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID        NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  old_cost_cents INTEGER,
  new_cost_cents INTEGER     NOT NULL,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  source        TEXT        NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual','invoice','import','bulk_update'))
);

CREATE INDEX IF NOT EXISTS idx_price_history_ingredient
  ON ingredient_price_history(ingredient_id, changed_at DESC);

-- ── 9. recipes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  code            TEXT,
  category        TEXT        NOT NULL DEFAULT 'food'
                    CHECK (category IN ('food','beverage','component','main','starter','dessert','side','other')),
  description     TEXT,
  method          TEXT,
  batch_yield     DECIMAL(10,4) NOT NULL DEFAULT 1,
  serve_unit      TEXT        DEFAULT 'portion',
  serve_size      DECIMAL(10,4) DEFAULT 1,
  cost_per_batch  DECIMAL(12,4) DEFAULT 0,
  cost_per_serve  DECIMAL(12,4) DEFAULT 0,
  waste_percent   DECIMAL(5,4) DEFAULT 0,
  gp_target_percent DECIMAL(5,4),
  suggested_price DECIMAL(12,2),
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','published','archived')),
  version         INTEGER     DEFAULT 1,
  allergens       TEXT[],
  prep_time_mins  INTEGER,
  cook_time_mins  INTEGER,
  image_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_org ON recipes(org_id);

-- ── 10. recipe_ingredients ───────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID        NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity      DECIMAL(12,4) NOT NULL,
  unit          TEXT        NOT NULL,
  is_sub_recipe BOOLEAN     DEFAULT false,
  sub_recipe_id UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  cost          DECIMAL(12,4) DEFAULT 0,
  sort_order    INTEGER     DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe     ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

-- ── 11. menu_sections ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_sections (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  description TEXT,
  sort_order INTEGER     DEFAULT 0,
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_sections_org ON menu_sections(org_id);

-- ── 12. menu_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipe_id            UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  section_id           UUID        REFERENCES menu_sections(id) ON DELETE SET NULL,
  name                 TEXT        NOT NULL,
  description          TEXT,
  sell_price           DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_price_gst_inclusive BOOLEAN   DEFAULT true,
  cost_per_serve       DECIMAL(12,4) DEFAULT 0,
  use_recipe_cost      BOOLEAN     DEFAULT true,
  gp_percent           DECIMAL(5,4) DEFAULT 0,
  pos_item_id          TEXT,
  pos_item_name        TEXT,
  category             TEXT,
  tags                 TEXT[],
  allergens            TEXT[],
  is_active            BOOLEAN     DEFAULT true,
  is_available         BOOLEAN     DEFAULT true,
  image_url            TEXT,
  sort_order           INTEGER     DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID
);

CREATE INDEX IF NOT EXISTS idx_menu_items_org ON menu_items(org_id);

-- ── 13. purchase_orders ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id           UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  supplier_id        UUID        NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  po_number          TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','submitted','confirmed','partially_received','received','cancelled')),
  order_date         DATE,
  expected_delivery  DATE,
  actual_delivery    DATE,
  subtotal           DECIMAL(12,2) DEFAULT 0,
  gst_amount         DECIMAL(12,2) DEFAULT 0,
  total              DECIMAL(12,2) DEFAULT 0,
  delivery_notes     TEXT,
  requires_approval  BOOLEAN     DEFAULT false,
  approved_by        UUID        REFERENCES profiles(id),
  approved_at        TIMESTAMPTZ,
  received_by_name   TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID        REFERENCES profiles(id),
  submitted_by       UUID        REFERENCES profiles(id),
  submitted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_org   ON purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_venue ON purchase_orders(venue_id);

-- ── 14. purchase_order_items ─────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id             UUID        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id     UUID        NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_ordered  DECIMAL(12,4) NOT NULL,
  unit              TEXT        NOT NULL,
  unit_cost         DECIMAL(12,4) NOT NULL,
  quantity_received DECIMAL(12,4) DEFAULT 0,
  received_at       TIMESTAMPTZ,
  received_by       UUID        REFERENCES profiles(id),
  line_total        DECIMAL(12,2) DEFAULT 0,
  gst_amount        DECIMAL(12,2) DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

-- ── 15. stock_counts ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_counts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id         UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  count_type       TEXT        NOT NULL DEFAULT 'full'
                     CHECK (count_type IN ('full','cycle','spot')),
  count_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT        NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','submitted','approved')),
  storage_location TEXT,
  total_value      DECIMAL(12,2) DEFAULT 0,
  variance_value   DECIMAL(12,2) DEFAULT 0,
  approved_by      UUID        REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_org ON stock_counts(org_id);

-- ── 16. stock_count_items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_count_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID        NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  ingredient_id  UUID        NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  expected_qty   DECIMAL(12,4),
  counted_qty    DECIMAL(12,4) NOT NULL,
  unit           TEXT        NOT NULL,
  variance_qty   DECIMAL(12,4) DEFAULT 0,
  variance_value DECIMAL(12,2) DEFAULT 0,
  variance_percent DECIMAL(5,4) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_count_items_count ON stock_count_items(stock_count_id);

-- ── 17. stock_levels ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_levels (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id    UUID        NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_on_hand DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit             TEXT        NOT NULL,
  last_count_date  DATE,
  last_count_qty   DECIMAL(12,4),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venue_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_levels_venue ON stock_levels(venue_id);

-- ── 18. waste_logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waste_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id         UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id    UUID        NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  waste_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  waste_type       TEXT        NOT NULL
                     CHECK (waste_type IN ('spoilage','breakage','over_production','prep_waste','staff_meal','promo','other')),
  quantity         DECIMAL(12,4) NOT NULL,
  unit             TEXT        NOT NULL,
  cost_value       DECIMAL(12,2) DEFAULT 0,
  cost_at_time     INTEGER,
  reason           TEXT,
  reason_code      TEXT,
  daypart          TEXT,
  photo_url        TEXT,
  requires_approval BOOLEAN    DEFAULT false,
  approved_by      UUID        REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_org        ON waste_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_venue_date ON waste_logs(venue_id, waste_date DESC);
CREATE INDEX IF NOT EXISTS idx_waste_logs_reason_code ON waste_logs(reason_code) WHERE reason_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waste_logs_daypart     ON waste_logs(daypart) WHERE daypart IS NOT NULL;

-- ── 19. staff ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id                 UUID        NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  date_of_birth                 DATE,
  gender                        TEXT,
  address_line1                 TEXT,
  address_line2                 TEXT,
  suburb                        TEXT,
  state                         TEXT,
  postcode                      TEXT,
  emergency_contact_name        TEXT,
  emergency_contact_phone       TEXT,
  emergency_contact_relationship TEXT,
  employment_type               TEXT        NOT NULL DEFAULT 'casual'
                                  CHECK (employment_type IN ('full_time','part_time','casual')),
  position                      TEXT,
  award_classification          TEXT,
  base_hourly_rate              DECIMAL(10,2),
  start_date                    DATE,
  end_date                      DATE,
  tfn_provided                  BOOLEAN     DEFAULT false,
  tfn_declaration_date          DATE,
  super_fund_name               TEXT,
  super_fund_abn                TEXT,
  super_member_number           TEXT,
  bank_bsb                      TEXT,
  bank_account_number           TEXT,
  bank_account_name             TEXT,
  onboarding_status             TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (onboarding_status IN ('pending','in_progress','completed','roster_ready')),
  pin_code                      TEXT,
  id_verified                   BOOLEAN     DEFAULT false,
  contract_signed               BOOLEAN     DEFAULT false,
  contract_signed_at            TIMESTAMPTZ,
  fwis_acknowledged             BOOLEAN     DEFAULT false,
  fwis_acknowledged_at          TIMESTAMPTZ,
  policies_acknowledged         BOOLEAN     DEFAULT false,
  policies_acknowledged_at      TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_org_member ON staff(org_member_id);

-- ── 20. staff_availability ───────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_availability (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID    NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_available BOOLEAN DEFAULT true,
  start_time  TIME,
  end_time    TIME,
  approved_by UUID    REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_staff ON staff_availability(staff_id);

-- ── 21. staff_documents ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  document_type TEXT        NOT NULL
                  CHECK (document_type IN ('id','visa','contract','tfn_declaration','super_choice','rsa','food_safety','police_check','wwcc','other')),
  file_name     TEXT        NOT NULL,
  file_url      TEXT        NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  expires_at    DATE,
  expiry_reminded BOOLEAN   DEFAULT false,
  verified_by   UUID        REFERENCES profiles(id),
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by   UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff ON staff_documents(staff_id);

-- ── 22. leave_requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type       TEXT        NOT NULL
                     CHECK (leave_type IN ('annual','personal','unpaid','long_service','compassionate','other')),
  start_date       DATE        NOT NULL,
  end_date         DATE        NOT NULL,
  reason           TEXT,
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by      UUID        REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id);

-- ── 23. shift_templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id        UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  description     TEXT,
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,
  break_minutes   INTEGER     DEFAULT 0,
  position        TEXT        NOT NULL DEFAULT 'crew',
  days_of_week    INTEGER[]   DEFAULT '{}',
  template_shifts JSONB       NOT NULL DEFAULT '[]',
  usage_count     INTEGER     DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  is_active       BOOLEAN     DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_org   ON shift_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_venue ON shift_templates(venue_id);

-- ── 24. roster_shifts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roster_shifts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id           UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id           UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date         DATE        NOT NULL,
  start_time         TIMESTAMPTZ NOT NULL,
  end_time           TIMESTAMPTZ NOT NULL,
  break_duration_mins INTEGER    DEFAULT 0,
  position           TEXT,
  status             TEXT        NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','published','confirmed','completed','cancelled')),
  hourly_rate        DECIMAL(10,2),
  penalty_rate       DECIMAL(5,4) DEFAULT 1,
  penalty_type       TEXT        DEFAULT 'none'
                       CHECK (penalty_type IN ('none','saturday','sunday','public_holiday','late_night','early_morning')),
  base_cost          DECIMAL(10,2) DEFAULT 0,
  penalty_cost       DECIMAL(10,2) DEFAULT 0,
  estimated_cost     DECIMAL(10,2) DEFAULT 0,
  is_open_shift      BOOLEAN     DEFAULT false,
  template_id        UUID        REFERENCES shift_templates(id) ON DELETE SET NULL,
  notes              TEXT,
  published_at       TIMESTAMPTZ,
  confirmed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_roster_shifts_org        ON roster_shifts(org_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_venue      ON roster_shifts(venue_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_staff      ON roster_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_date       ON roster_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_created_at ON roster_shifts(created_at);

-- ── 25. timesheets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheets (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id         UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id         UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  roster_shift_id  UUID        REFERENCES roster_shifts(id) ON DELETE SET NULL,
  work_date        DATE        NOT NULL,
  clock_in         TIMESTAMPTZ NOT NULL,
  clock_out        TIMESTAMPTZ,
  break_start      TIMESTAMPTZ,
  break_end        TIMESTAMPTZ,
  total_break_mins DECIMAL(5,2) DEFAULT 0,
  total_hours      DECIMAL(5,2) DEFAULT 0,
  clock_in_lat     DECIMAL(10,8),
  clock_in_lng     DECIMAL(11,8),
  clock_out_lat    DECIMAL(10,8),
  clock_out_lng    DECIMAL(11,8),
  clock_in_method  TEXT        DEFAULT 'app'
                     CHECK (clock_in_method IN ('app','pin','manual')),
  status           TEXT        NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','submitted','approved','rejected','exported','pending')),
  hourly_rate      DECIMAL(10,2),
  penalty_rate     DECIMAL(5,4) DEFAULT 1,
  overtime_hours   DECIMAL(5,2) DEFAULT 0,
  total_pay        DECIMAL(10,2) DEFAULT 0,
  approved_by      UUID        REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  edited           BOOLEAN     DEFAULT false,
  edit_reason      TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timesheets_org       ON timesheets(org_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_venue     ON timesheets(venue_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_staff     ON timesheets(staff_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date      ON timesheets(work_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_work_date ON timesheets(work_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_created_at ON timesheets(created_at);

-- ── 26. roster_warnings ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS roster_warnings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id        UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  shift_id        UUID        REFERENCES roster_shifts(id) ON DELETE CASCADE,
  staff_id        UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  warning_type    TEXT        NOT NULL
                    CHECK (warning_type IN ('overtime_weekly','overtime_daily','rest_gap','break_required','availability_conflict','qualification_missing','minor_hours','budget_exceeded')),
  severity        TEXT        NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('info','warning','error')),
  message         TEXT        NOT NULL,
  details         JSONB,
  acknowledged    BOOLEAN     DEFAULT false,
  acknowledged_by UUID        REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roster_warnings_org   ON roster_warnings(org_id);
CREATE INDEX IF NOT EXISTS idx_roster_warnings_venue ON roster_warnings(venue_id);
CREATE INDEX IF NOT EXISTS idx_roster_warnings_staff ON roster_warnings(staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_warnings_shift ON roster_warnings(shift_id);

-- ── 27. shift_swap_requests ──────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id          UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  original_shift_id UUID        NOT NULL REFERENCES roster_shifts(id) ON DELETE CASCADE,
  original_staff_id UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  target_staff_id   UUID        REFERENCES staff(id) ON DELETE SET NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at      TIMESTAMPTZ,
  responded_by      UUID        REFERENCES profiles(id),
  rejection_reason  TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_org            ON shift_swap_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_venue          ON shift_swap_requests(venue_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_original_shift ON shift_swap_requests(original_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_status         ON shift_swap_requests(status);

-- ── 28. labor_budgets ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labor_budgets (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id                  UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  period_type               TEXT        NOT NULL DEFAULT 'weekly'
                              CHECK (period_type IN ('weekly','monthly')),
  period_start              DATE        NOT NULL,
  period_end                DATE        NOT NULL,
  budgeted_amount           NUMERIC     NOT NULL DEFAULT 0,
  actual_amount             NUMERIC     DEFAULT 0,
  revenue_target            NUMERIC,
  warning_threshold_percent NUMERIC     DEFAULT 90,
  critical_threshold_percent NUMERIC    DEFAULT 100,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_labor_budgets_org    ON labor_budgets(org_id);
CREATE INDEX IF NOT EXISTS idx_labor_budgets_venue  ON labor_budgets(venue_id);
CREATE INDEX IF NOT EXISTS idx_labor_budgets_period ON labor_budgets(period_start, period_end);

-- ── 29. roster_patterns ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS roster_patterns (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id    UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  shifts      JSONB       NOT NULL DEFAULT '[]',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roster_patterns_org   ON roster_patterns(org_id);
CREATE INDEX IF NOT EXISTS idx_roster_patterns_venue ON roster_patterns(venue_id);

-- ── 30. staff_invites ────────────────────────────────────────
-- NOTE: USING(true) SELECT was removed — see audit fix H2.
-- Token-based lookup for unauthenticated users must go through
-- server-side /api/invites/verify (see AUDIT_SUMMARY.md).
CREATE TABLE IF NOT EXISTS staff_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id     TEXT,
  role         TEXT        NOT NULL DEFAULT 'staff',
  token        TEXT        NOT NULL UNIQUE,
  sent_to_email TEXT       NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  accessed_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  invited_by   UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_org_id ON staff_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_token  ON staff_invites(token);

-- ── 31. onboarding_invites ───────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_invites (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id           UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  email              TEXT        NOT NULL,
  first_name         TEXT,
  last_name          TEXT,
  token              TEXT        NOT NULL UNIQUE,
  expires_at         TIMESTAMPTZ NOT NULL,
  position           TEXT,
  employment_type    TEXT        DEFAULT 'casual',
  base_hourly_rate   DECIMAL(10,2),
  planned_start_date DATE,
  status             TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','opened','in_progress','completed','expired','cancelled')),
  staff_id           UUID        REFERENCES staff(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID        REFERENCES profiles(id),
  opened_at          TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_onboarding_invites_org   ON onboarding_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_token ON onboarding_invites(token);

-- ── 32. qualification_types ──────────────────────────────────
CREATE TABLE IF NOT EXISTS qualification_types (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  description        TEXT,
  validity_months    INTEGER,
  required_for_roles TEXT[]      NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qualification_types_org ON qualification_types(org_id);

-- ── 33. staff_qualifications ─────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_qualifications (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id              UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  qualification_type_id UUID        NOT NULL REFERENCES qualification_types(id) ON DELETE CASCADE,
  issue_date            DATE,
  expiry_date           DATE,
  certificate_number    TEXT,
  evidence_url          TEXT,
  status                TEXT        NOT NULL DEFAULT 'valid'
                          CHECK (status IN ('valid','expiring','expired')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, qualification_type_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_org    ON staff_qualifications(org_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_staff  ON staff_qualifications(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_expiry ON staff_qualifications(expiry_date)
  WHERE expiry_date IS NOT NULL;

-- ── 34. pos_connections ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider         TEXT        NOT NULL DEFAULT 'square'
                     CHECK (provider IN ('square','lightspeed','kounta','other')),
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  merchant_id      TEXT,
  merchant_name    TEXT,
  sync_frequency   TEXT        DEFAULT 'hourly'
                     CHECK (sync_frequency IN ('realtime','hourly','daily')),
  last_sync_at     TIMESTAMPTZ,
  last_sync_status TEXT,
  sync_from_date   DATE,
  is_active        BOOLEAN     DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_by     UUID        REFERENCES profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_connections_org_provider
  ON pos_connections(org_id, provider)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pos_connections_org ON pos_connections(org_id);

-- ── 35. pos_location_mappings ────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_location_mappings (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_connection_id   UUID    NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  venue_id            UUID    NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  pos_location_id     TEXT    NOT NULL,
  pos_location_name   TEXT,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pos_connection_id, pos_location_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_location_mappings_connection ON pos_location_mappings(pos_connection_id);
CREATE INDEX IF NOT EXISTS idx_pos_location_mappings_venue      ON pos_location_mappings(venue_id);

-- ── 36. sales_transactions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_transactions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id            UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  pos_connection_id   UUID        REFERENCES pos_connections(id),
  pos_transaction_id  TEXT,
  transaction_date    DATE        NOT NULL,
  transaction_time    TIME        NOT NULL,
  transaction_at      TIMESTAMPTZ NOT NULL,
  transaction_type    TEXT        NOT NULL DEFAULT 'sale'
                        CHECK (transaction_type IN ('sale','refund','void')),
  order_type          TEXT        DEFAULT 'dine_in'
                        CHECK (order_type IN ('dine_in','takeaway','delivery','online')),
  subtotal            DECIMAL(12,2) DEFAULT 0,
  discount_amount     DECIMAL(12,2) DEFAULT 0,
  gst_amount          DECIMAL(12,2) DEFAULT 0,
  total               DECIMAL(12,2) DEFAULT 0,
  item_count          INTEGER     DEFAULT 0,
  payment_method      TEXT,
  customer_name       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_org   ON sales_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_venue ON sales_transactions(venue_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date  ON sales_transactions(transaction_date);

-- ── 37. sales_transaction_items ──────────────────────────────
CREATE TABLE IF NOT EXISTS sales_transaction_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID        NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  menu_item_id    UUID        REFERENCES menu_items(id) ON DELETE SET NULL,
  pos_item_id     TEXT,
  name            TEXT        NOT NULL,
  quantity        DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price      DECIMAL(12,2) NOT NULL,
  modifiers       JSONB,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  line_total      DECIMAL(12,2) DEFAULT 0,
  cost_per_unit   DECIMAL(12,4) DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_items_transaction ON sales_transaction_items(transaction_id);

-- ── 38. daybook_entries ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS daybook_entries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id     UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  entry_date   DATE        NOT NULL,
  pos_sales    DECIMAL(12,2) DEFAULT 0,
  cash_counted DECIMAL(12,2) DEFAULT 0,
  card_total   DECIMAL(12,2) DEFAULT 0,
  variance     DECIMAL(12,2) DEFAULT 0,
  notes        TEXT,
  issues       TEXT,
  status       TEXT        NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','submitted','approved','draft')),
  approved_by  UUID        REFERENCES profiles(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_daybook_entries_org   ON daybook_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_daybook_entries_venue ON daybook_entries(venue_id);
CREATE INDEX IF NOT EXISTS idx_daybook_entries_date  ON daybook_entries(entry_date);

-- ── 39. compliance_checks ────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_checks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id    UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  check_type  TEXT        NOT NULL,
  check_date  DATE        NOT NULL,
  check_time  TIME,
  passed      BOOLEAN,
  value       TEXT,
  notes       TEXT,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_venue ON compliance_checks(venue_id);

-- ── 40. public_holidays ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_holidays (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  date        DATE        NOT NULL,
  state       TEXT,
  is_national BOOLEAN     NOT NULL DEFAULT false,
  is_custom   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date  ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_org   ON public_holidays(org_id);
CREATE INDEX IF NOT EXISTS idx_public_holidays_state ON public_holidays(state);

-- ── 41. chart_of_accounts ────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category              TEXT        NOT NULL
                          CHECK (category IN ('revenue','cogs','labour','overhead','other')),
  subcategory           TEXT,
  external_system       TEXT        DEFAULT 'xero'
                          CHECK (external_system IN ('xero','myob','quickbooks')),
  external_account_id   TEXT,
  external_account_name TEXT,
  external_account_code TEXT,
  is_active             BOOLEAN     DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coa_org ON chart_of_accounts(org_id);

-- ── 42. audit_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        REFERENCES organizations(id) ON DELETE SET NULL,
  table_name     TEXT        NOT NULL,
  record_id      UUID        NOT NULL,
  action         TEXT        NOT NULL CHECK (action IN ('create','update','delete')),
  old_data       JSONB,
  new_data       JSONB,
  changed_fields TEXT[],
  user_id        UUID        REFERENCES profiles(id),
  user_email     TEXT,
  ip_address     INET,
  user_agent     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org   ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);

-- ── 43. admin_data_jobs / admin_data_audit ───────────────────
CREATE TABLE IF NOT EXISTS admin_data_jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type     TEXT        NOT NULL
                 CHECK (job_type IN ('EXPORT_ALL','ORG_WIPE','PERSISTENCE_CHECK')),
  requested_by TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','running','succeeded','failed')),
  details_json JSONB,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_data_audit (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id       TEXT        NOT NULL,
  action              TEXT        NOT NULL,
  before_counts_json  JSONB,
  after_counts_json   JSONB,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_data_jobs_status     ON admin_data_jobs(status);
CREATE INDEX IF NOT EXISTS idx_admin_data_jobs_created_at ON admin_data_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_data_audit_created_at ON admin_data_audit(created_at DESC);

-- ── 44. invoices ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id             UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  supplier_id          UUID        REFERENCES suppliers(id) ON DELETE SET NULL,
  source               TEXT        NOT NULL DEFAULT 'upload'
                         CHECK (source IN ('upload','email')),
  original_file_url    TEXT,
  original_filename    TEXT,
  invoice_number       TEXT,
  invoice_date         DATE,
  due_date             DATE,
  subtotal             NUMERIC(12,2),
  tax_amount           NUMERIC(12,2),
  total_amount         NUMERIC(12,2),
  currency             TEXT        NOT NULL DEFAULT 'AUD',
  document_type        TEXT        NOT NULL DEFAULT 'invoice'
                         CHECK (document_type IN ('invoice','credit_note','statement')),
  status               TEXT        NOT NULL DEFAULT 'pending_review'
                         CHECK (status IN ('pending_review','confirmed','disputed','duplicate')),
  matched_po_id        UUID        REFERENCES purchase_orders(id) ON DELETE SET NULL,
  sender_email         TEXT,
  processing_metadata  JSONB,
  confirmed_by         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  confirmed_at         TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_org_id_idx      ON invoices(org_id);
CREATE INDEX IF NOT EXISTS invoices_venue_id_idx    ON invoices(venue_id);
CREATE INDEX IF NOT EXISTS invoices_supplier_id_idx ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx      ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_invoice_date_idx ON invoices(invoice_date DESC);

-- ── 45. invoice_line_items ───────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  ingredient_id        UUID        REFERENCES ingredients(id) ON DELETE SET NULL,
  raw_description      TEXT        NOT NULL,
  extracted_quantity   NUMERIC(12,4),
  extracted_unit       TEXT,
  extracted_unit_price NUMERIC(12,4),
  extracted_line_total NUMERIC(12,2),
  extracted_tax        NUMERIC(12,2),
  extracted_discount   NUMERIC(12,2),
  confidence_score     NUMERIC(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  match_status         TEXT        NOT NULL DEFAULT 'unmatched'
                         CHECK (match_status IN ('auto_matched','manual_matched','new_ingredient','unmatched')),
  confirmed_quantity   NUMERIC(12,4),
  confirmed_unit_price NUMERIC(12,4),
  variance_notes       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id_idx    ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_line_items_ingredient_id_idx ON invoice_line_items(ingredient_id);

-- ── 46. reconciliation_logs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  purchase_order_id     UUID        REFERENCES purchase_orders(id) ON DELETE SET NULL,
  venue_id              UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  reconciled_by         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reconciled_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_expected_value  NUMERIC(12,2),
  total_received_value  NUMERIC(12,2),
  total_variance        NUMERIC(12,2),
  status                TEXT        NOT NULL DEFAULT 'fully_received'
                          CHECK (status IN ('fully_received','partial','disputed')),
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS reconciliation_logs_invoice_id_idx ON reconciliation_logs(invoice_id);
CREATE INDEX IF NOT EXISTS reconciliation_logs_venue_id_idx   ON reconciliation_logs(venue_id);
CREATE INDEX IF NOT EXISTS reconciliation_logs_po_id_idx      ON reconciliation_logs(purchase_order_id);

-- ── 47. reconciliation_line_items ────────────────────────────
CREATE TABLE IF NOT EXISTS reconciliation_line_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id    UUID        NOT NULL REFERENCES reconciliation_logs(id) ON DELETE CASCADE,
  invoice_line_item_id UUID        REFERENCES invoice_line_items(id) ON DELETE SET NULL,
  po_line_item_id      UUID        REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  ingredient_id        UUID        REFERENCES ingredients(id) ON DELETE SET NULL,
  expected_quantity    NUMERIC(12,4),
  received_quantity    NUMERIC(12,4),
  expected_unit_price  NUMERIC(12,4),
  actual_unit_price    NUMERIC(12,4),
  quantity_variance    NUMERIC(12,4),
  price_variance       NUMERIC(12,4),
  status               TEXT        NOT NULL DEFAULT 'received_full'
                         CHECK (status IN ('received_full','received_partial','not_received','unexpected')),
  notes                TEXT
);

CREATE INDEX IF NOT EXISTS recon_line_items_recon_id_idx      ON reconciliation_line_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS recon_line_items_ingredient_id_idx ON reconciliation_line_items(ingredient_id);

-- ── 48. xero_connections ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS xero_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  tenant_id        TEXT,
  tenant_name      TEXT,
  tenant_type      TEXT,
  last_sync_at     TIMESTAMPTZ,
  last_sync_status TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  connected_by     UUID        REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT xero_connections_org_id_unique UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_xero_connections_org_id ON xero_connections(org_id);

-- ── 49. xero_sync_log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xero_sync_log (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  xero_connection_id UUID        REFERENCES xero_connections(id) ON DELETE SET NULL,
  direction          TEXT        NOT NULL CHECK (direction IN ('push','pull','both')),
  sync_type          TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','success','partial','error')),
  records_pushed     INTEGER     DEFAULT 0,
  records_pulled     INTEGER     DEFAULT 0,
  error_message      TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xero_sync_log_org_id     ON xero_sync_log(org_id);
CREATE INDEX IF NOT EXISTS idx_xero_sync_log_started_at ON xero_sync_log(started_at DESC);

-- ── 50. xero_account_mappings ────────────────────────────────
CREATE TABLE IF NOT EXISTS xero_account_mappings (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supersolt_category  TEXT        NOT NULL,
  xero_account_code   TEXT,
  xero_account_id     TEXT,
  xero_account_name   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT xero_account_mappings_org_category_unique UNIQUE (org_id, supersolt_category)
);

CREATE INDEX IF NOT EXISTS idx_xero_account_mappings_org_id ON xero_account_mappings(org_id);

-- ── 51. square_catalog_mappings ──────────────────────────────
CREATE TABLE IF NOT EXISTS square_catalog_mappings (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id               UUID        REFERENCES venues(id) ON DELETE CASCADE,
  square_catalog_item_id TEXT        NOT NULL,
  square_item_name       TEXT        NOT NULL,
  recipe_id              UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT square_catalog_mappings_org_item_unique UNIQUE (org_id, square_catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_square_catalog_mappings_org_venue
  ON square_catalog_mappings(org_id, venue_id)
  WHERE is_active = true;

-- ── 52. square_modifier_mappings ─────────────────────────────
CREATE TABLE IF NOT EXISTS square_modifier_mappings (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  square_modifier_id   TEXT        NOT NULL,
  square_modifier_name TEXT        NOT NULL,
  ingredient_id        UUID        REFERENCES ingredients(id) ON DELETE SET NULL,
  quantity_adjustment  NUMERIC(10,4) NOT NULL DEFAULT 0,
  adjustment_type      TEXT        NOT NULL DEFAULT 'add'
                         CHECK (adjustment_type IN ('add','remove','replace')),
  unit                 TEXT        NOT NULL DEFAULT 'g',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT square_modifier_mappings_org_modifier_unique UNIQUE (org_id, square_modifier_id)
);

CREATE INDEX IF NOT EXISTS idx_square_modifier_mappings_org ON square_modifier_mappings(org_id);

-- ── 53. ingredient_waste_factors ─────────────────────────────
CREATE TABLE IF NOT EXISTS ingredient_waste_factors (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id         UUID        REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id    UUID        NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  waste_percentage NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (waste_percentage >= 0 AND waste_percentage <= 100),
  waste_type       TEXT        NOT NULL DEFAULT 'trim'
                     CHECK (waste_type IN ('trim','spillage','evaporation','overportioning')),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredient_waste_factors_ingredient
  ON ingredient_waste_factors(org_id, venue_id, ingredient_id);

-- ── 54. stock_depletion_queue ────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_depletion_queue (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id         UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  square_order_id  TEXT        NOT NULL,
  line_items       JSONB       NOT NULL DEFAULT '[]',
  status           TEXT        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','completed','failed','skipped')),
  error_message    TEXT,
  retry_count      INTEGER     NOT NULL DEFAULT 0,
  reversed_at      TIMESTAMPTZ,
  reversal_reason  TEXT,
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_depletion_queue_org_order_unique UNIQUE (org_id, square_order_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_depletion_queue_status
  ON stock_depletion_queue(org_id, status)
  WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_stock_depletion_queue_venue_created
  ON stock_depletion_queue(venue_id, created_at DESC);

-- ── 55. stock_movements (append-only) ────────────────────────
CREATE TABLE IF NOT EXISTS stock_movements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id       UUID        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id  UUID        NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type  TEXT        NOT NULL
                   CHECK (movement_type IN ('sale_depletion','purchase_receipt','waste_log','stock_count_adjustment','manual_adjustment','refund_reversal','opening_stock')),
  quantity       NUMERIC(12,4) NOT NULL,
  unit           TEXT          NOT NULL,
  unit_cost      NUMERIC(10,4),
  reference_type TEXT,
  reference_id   TEXT,
  notes          TEXT,
  created_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient
  ON stock_movements(venue_id, ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
  ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_venue_type
  ON stock_movements(org_id, venue_id, movement_type, created_at DESC);

-- ── 56. demand_forecasts ─────────────────────────────────────
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
  mape               NUMERIC(6,3),
  actual_quantity    NUMERIC(10,2),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT demand_forecasts_venue_item_date_unique UNIQUE (venue_id, menu_item_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_demand_forecasts_venue_date ON demand_forecasts(venue_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_item       ON demand_forecasts(menu_item_id, forecast_date);

-- ── 57. supplier_lead_time_logs ──────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_lead_time_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id       UUID        NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  purchase_order_id UUID        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  submitted_at      TIMESTAMPTZ NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL,
  actual_lead_days  NUMERIC(6,2) NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_lead_time_logs_supplier
  ON supplier_lead_time_logs(org_id, supplier_id, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_lead_time_logs_po
  ON supplier_lead_time_logs(purchase_order_id);


-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS calculate_menu_item_gp_trigger ON menu_items;
CREATE TRIGGER calculate_menu_item_gp_trigger
  BEFORE INSERT OR UPDATE OF sell_price, cost_per_serve ON menu_items
  FOR EACH ROW EXECUTE FUNCTION calculate_menu_item_gp();

DROP TRIGGER IF EXISTS update_admin_data_jobs_updated_at ON admin_data_jobs;
CREATE TRIGGER update_admin_data_jobs_updated_at
  BEFORE UPDATE ON admin_data_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_templates_updated_at ON shift_templates;
CREATE TRIGGER update_shift_templates_updated_at
  BEFORE UPDATE ON shift_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_swap_requests_updated_at ON shift_swap_requests;
CREATE TRIGGER update_shift_swap_requests_updated_at
  BEFORE UPDATE ON shift_swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_budgets_updated_at ON labor_budgets;
CREATE TRIGGER update_labor_budgets_updated_at
  BEFORE UPDATE ON labor_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_roster_patterns_updated_at ON roster_patterns;
CREATE TRIGGER update_roster_patterns_updated_at
  BEFORE UPDATE ON roster_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_public_holidays_updated_at ON public_holidays;
CREATE TRIGGER update_public_holidays_updated_at
  BEFORE UPDATE ON public_holidays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_square_catalog_mappings_updated_at ON square_catalog_mappings;
CREATE TRIGGER set_square_catalog_mappings_updated_at
  BEFORE UPDATE ON square_catalog_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_square_modifier_mappings_updated_at ON square_modifier_mappings;
CREATE TRIGGER set_square_modifier_mappings_updated_at
  BEFORE UPDATE ON square_modifier_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_ingredient_waste_factors_updated_at ON ingredient_waste_factors;
CREATE TRIGGER set_ingredient_waste_factors_updated_at
  BEFORE UPDATE ON ingredient_waste_factors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_access           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_waste_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients     ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability     ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_shifts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_warnings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swap_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_patterns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_invites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_qualifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_connections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_location_mappings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daybook_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_audit       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_connections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_sync_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE xero_account_mappings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_catalog_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE square_modifier_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_depletion_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_forecasts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_lead_time_logs ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile"       ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"     ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"     ON profiles;
DROP POLICY IF EXISTS "Org members can view peer profiles" ON profiles;
CREATE POLICY "profiles_select_own"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"   ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_select_peers" ON profiles FOR SELECT USING (
  id IN (
    SELECT om2.user_id FROM org_members om2
    WHERE om2.org_id IN (
      SELECT om1.org_id FROM org_members om1 WHERE om1.user_id = auth.uid()
    )
  )
);

-- ── organizations ────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update organization"       ON organizations;
CREATE POLICY "organizations_select" ON organizations FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));
CREATE POLICY "organizations_update" ON organizations FOR UPDATE
  USING (is_org_admin(id));

-- ── venues ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view venues" ON venues;
DROP POLICY IF EXISTS "Admins can manage venues" ON venues;
CREATE POLICY "venues_select" ON venues FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "venues_admin"  ON venues FOR ALL
  USING (is_org_admin(org_id));

-- ── org_members ──────────────────────────────────────────────
DROP POLICY IF EXISTS "View org members"       ON org_members;
DROP POLICY IF EXISTS "Admins can manage members" ON org_members;
CREATE POLICY "org_members_select" ON org_members FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "org_members_admin"  ON org_members FOR ALL
  USING (is_org_admin(org_id));

-- ── venue_access ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Access venue permissions"             ON venue_access;
DROP POLICY IF EXISTS "Org members can view venue_access in their org" ON venue_access;
DROP POLICY IF EXISTS "Managers can manage venue_access"     ON venue_access;
CREATE POLICY "venue_access_select" ON venue_access FOR SELECT USING (
  org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()))
);
CREATE POLICY "venue_access_admin"  ON venue_access FOR ALL USING (
  org_member_id IN (
    SELECT id FROM org_members
    WHERE org_id IN (SELECT get_user_org_ids())
      AND role IN ('owner','manager')
  )
);

-- ── suppliers ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view suppliers"  ON suppliers;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "suppliers_admin"  ON suppliers FOR ALL
  USING (is_org_admin(org_id));

-- ── ingredients ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view ingredients"  ON ingredients;
DROP POLICY IF EXISTS "Admins can manage ingredients" ON ingredients;
CREATE POLICY "ingredients_select" ON ingredients FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "ingredients_admin"  ON ingredients FOR ALL
  USING (is_org_admin(org_id));

-- ── ingredient_price_history (audit fix C1/H3 — org_id not venue_id) ─────
DROP POLICY IF EXISTS "Users can view price history for their org ingredients"   ON ingredient_price_history;
DROP POLICY IF EXISTS "Users can insert price history for their org ingredients" ON ingredient_price_history;
DROP POLICY IF EXISTS "Org members can view ingredient price history"            ON ingredient_price_history;
DROP POLICY IF EXISTS "Org members can insert ingredient price history"          ON ingredient_price_history;
CREATE POLICY "ingredient_price_history_select" ON ingredient_price_history FOR SELECT
  USING (ingredient_id IN (
    SELECT id FROM ingredients WHERE org_id IN (SELECT get_user_org_ids())
  ));
CREATE POLICY "ingredient_price_history_insert" ON ingredient_price_history FOR INSERT
  WITH CHECK (ingredient_id IN (
    SELECT id FROM ingredients WHERE org_id IN (SELECT get_user_org_ids())
  ));
-- Append-only — no UPDATE or DELETE
CREATE POLICY "ingredient_price_history_no_delete" ON ingredient_price_history FOR DELETE
  USING (false);

-- ── ingredient_waste_factors ─────────────────────────────────
CREATE POLICY "ingredient_waste_factors_select" ON ingredient_waste_factors FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "ingredient_waste_factors_insert" ON ingredient_waste_factors FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "ingredient_waste_factors_update" ON ingredient_waste_factors FOR UPDATE
  USING (is_org_admin(org_id));
CREATE POLICY "ingredient_waste_factors_delete" ON ingredient_waste_factors FOR DELETE
  USING (is_org_admin(org_id));

-- ── recipes ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view recipes"  ON recipes;
DROP POLICY IF EXISTS "Admins can manage recipes" ON recipes;
CREATE POLICY "recipes_select" ON recipes FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "recipes_admin"  ON recipes FOR ALL
  USING (is_org_admin(org_id));

-- ── recipe_ingredients ───────────────────────────────────────
DROP POLICY IF EXISTS "Access recipe ingredients"           ON recipe_ingredients;
DROP POLICY IF EXISTS "Org members can view recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Managers can manage recipe ingredients"  ON recipe_ingredients;
CREATE POLICY "recipe_ingredients_select" ON recipe_ingredients FOR SELECT
  USING (recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "recipe_ingredients_admin"  ON recipe_ingredients FOR ALL
  USING (recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids())));

-- ── menu_sections ────────────────────────────────────────────
CREATE POLICY "menu_sections_select" ON menu_sections FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "menu_sections_admin"  ON menu_sections FOR ALL
  USING (is_org_admin(org_id));

-- ── menu_items ───────────────────────────────────────────────
CREATE POLICY "menu_items_select" ON menu_items FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "menu_items_admin"  ON menu_items FOR ALL
  USING (is_org_admin(org_id));

-- ── purchase_orders ──────────────────────────────────────────
CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "purchase_orders_admin"  ON purchase_orders FOR ALL
  USING (is_org_admin(org_id));

-- ── purchase_order_items ─────────────────────────────────────
CREATE POLICY "po_items_all" ON purchase_order_items FOR ALL
  USING (po_id IN (SELECT id FROM purchase_orders WHERE org_id IN (SELECT get_user_org_ids())));

-- ── stock_counts ─────────────────────────────────────────────
CREATE POLICY "stock_counts_select" ON stock_counts FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "stock_counts_admin"  ON stock_counts FOR ALL
  USING (is_org_admin(org_id));

-- ── stock_count_items ────────────────────────────────────────
CREATE POLICY "stock_count_items_all" ON stock_count_items FOR ALL
  USING (stock_count_id IN (SELECT id FROM stock_counts WHERE org_id IN (SELECT get_user_org_ids())));

-- ── stock_levels ─────────────────────────────────────────────
CREATE POLICY "stock_levels_all" ON stock_levels FOR ALL
  USING (venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids())));

-- ── waste_logs ───────────────────────────────────────────────
CREATE POLICY "waste_logs_select" ON waste_logs FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "waste_logs_admin"  ON waste_logs FOR ALL
  USING (is_org_admin(org_id));

-- ── staff ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can view staff"  ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;
CREATE POLICY "staff_select" ON staff FOR SELECT
  USING (org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "staff_admin"  ON staff FOR ALL
  USING (org_member_id IN (
    SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()) AND role IN ('owner','manager')
  ));

-- ── staff_availability ───────────────────────────────────────
CREATE POLICY "staff_availability_select" ON staff_availability FOR SELECT
  USING (staff_id IN (
    SELECT s.id FROM staff s JOIN org_members om ON s.org_member_id = om.id
    WHERE om.org_id IN (SELECT get_user_org_ids())
  ));
CREATE POLICY "staff_availability_all" ON staff_availability FOR ALL
  USING (staff_id IN (
    SELECT s.id FROM staff s JOIN org_members om ON s.org_member_id = om.id
    WHERE om.org_id IN (SELECT get_user_org_ids())
  ));

-- ── staff_documents ──────────────────────────────────────────
CREATE POLICY "staff_documents_all" ON staff_documents FOR ALL
  USING (staff_id IN (
    SELECT s.id FROM staff s JOIN org_members om ON s.org_member_id = om.id
    WHERE om.org_id IN (SELECT get_user_org_ids())
  ));

-- ── leave_requests ───────────────────────────────────────────
CREATE POLICY "leave_requests_all" ON leave_requests FOR ALL
  USING (staff_id IN (
    SELECT s.id FROM staff s JOIN org_members om ON s.org_member_id = om.id
    WHERE om.org_id IN (SELECT get_user_org_ids())
  ));

-- ── shift_templates ──────────────────────────────────────────
CREATE POLICY "shift_templates_select" ON shift_templates FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "shift_templates_admin"  ON shift_templates FOR ALL
  USING (is_org_admin(org_id));

-- ── roster_shifts ────────────────────────────────────────────
CREATE POLICY "roster_shifts_select" ON roster_shifts FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "roster_shifts_admin"  ON roster_shifts FOR ALL
  USING (org_id IN (SELECT get_user_org_ids()) AND
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid()
      AND org_id = roster_shifts.org_id AND role IN ('owner','manager','supervisor')));

-- ── timesheets ───────────────────────────────────────────────
CREATE POLICY "timesheets_select" ON timesheets FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "timesheets_insert" ON timesheets FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "timesheets_admin"  ON timesheets FOR ALL
  USING (org_id IN (SELECT get_user_org_ids()) AND
    EXISTS (SELECT 1 FROM org_members WHERE user_id = auth.uid()
      AND org_id = timesheets.org_id AND role IN ('owner','manager','supervisor')));

-- ── roster_warnings ──────────────────────────────────────────
CREATE POLICY "roster_warnings_select" ON roster_warnings FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "roster_warnings_admin"  ON roster_warnings FOR ALL
  USING (is_org_admin(org_id));

-- ── shift_swap_requests ──────────────────────────────────────
CREATE POLICY "shift_swap_select" ON shift_swap_requests FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "shift_swap_insert" ON shift_swap_requests FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "shift_swap_admin"  ON shift_swap_requests FOR ALL
  USING (is_org_admin(org_id));

-- ── labor_budgets ────────────────────────────────────────────
CREATE POLICY "labor_budgets_select" ON labor_budgets FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "labor_budgets_admin"  ON labor_budgets FOR ALL
  USING (is_org_admin(org_id));

-- ── roster_patterns ──────────────────────────────────────────
CREATE POLICY "roster_patterns_select" ON roster_patterns FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "roster_patterns_admin"  ON roster_patterns FOR ALL
  USING (is_org_admin(org_id));

-- ── staff_invites (audit fix H2 — no USING(true)) ────────────
DROP POLICY IF EXISTS "Anyone can read invite by token"       ON staff_invites;
DROP POLICY IF EXISTS "Users can view invites for their org"  ON staff_invites;
DROP POLICY IF EXISTS "Users can insert invites for their org" ON staff_invites;
DROP POLICY IF EXISTS "Users can update invites for their org" ON staff_invites;
DROP POLICY IF EXISTS "Users can delete invites for their org" ON staff_invites;
CREATE POLICY "staff_invites_select" ON staff_invites FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "staff_invites_admin_insert" ON staff_invites FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = (SELECT auth.uid())
      AND org_id = staff_invites.org_id AND role IN ('owner','manager') AND is_active = true
  ));
CREATE POLICY "staff_invites_admin_update" ON staff_invites FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = (SELECT auth.uid())
      AND org_id = staff_invites.org_id AND role IN ('owner','manager') AND is_active = true
  ));
CREATE POLICY "staff_invites_admin_delete" ON staff_invites FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = (SELECT auth.uid())
      AND org_id = staff_invites.org_id AND role IN ('owner','manager') AND is_active = true
  ));

-- ── onboarding_invites ───────────────────────────────────────
CREATE POLICY "onboarding_invites_select" ON onboarding_invites FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "onboarding_invites_admin"  ON onboarding_invites FOR ALL
  USING (is_org_admin(org_id));

-- ── qualification_types (audit fix M2 — admin writes only) ───
DROP POLICY IF EXISTS "qual_types_select" ON qualification_types;
DROP POLICY IF EXISTS "qual_types_insert" ON qualification_types;
DROP POLICY IF EXISTS "qual_types_update" ON qualification_types;
DROP POLICY IF EXISTS "qual_types_delete" ON qualification_types;
CREATE POLICY "qual_types_select" ON qualification_types FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "qual_types_insert" ON qualification_types FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()) AND is_org_admin(org_id));
CREATE POLICY "qual_types_update" ON qualification_types FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()) AND is_org_admin(org_id));
CREATE POLICY "qual_types_delete" ON qualification_types FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()) AND is_org_admin(org_id));

-- ── staff_qualifications ─────────────────────────────────────
CREATE POLICY "staff_quals_select" ON staff_qualifications FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "staff_quals_insert" ON staff_qualifications FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "staff_quals_update" ON staff_qualifications FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "staff_quals_delete" ON staff_qualifications FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()));

-- ── pos_connections ──────────────────────────────────────────
CREATE POLICY "pos_connections_select" ON pos_connections FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "pos_connections_admin"  ON pos_connections FOR ALL
  USING (is_org_admin(org_id));

-- ── pos_location_mappings ────────────────────────────────────
CREATE POLICY "pos_location_mappings_select" ON pos_location_mappings FOR SELECT
  USING (pos_connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "pos_location_mappings_admin"  ON pos_location_mappings FOR ALL
  USING (pos_connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids())));

-- ── sales_transactions ───────────────────────────────────────
CREATE POLICY "sales_transactions_select" ON sales_transactions FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "sales_transactions_admin"  ON sales_transactions FOR ALL
  USING (is_org_admin(org_id));

-- ── sales_transaction_items ──────────────────────────────────
CREATE POLICY "sales_items_all" ON sales_transaction_items FOR ALL
  USING (transaction_id IN (SELECT id FROM sales_transactions WHERE org_id IN (SELECT get_user_org_ids())));

-- ── daybook_entries ──────────────────────────────────────────
CREATE POLICY "daybook_entries_select" ON daybook_entries FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "daybook_entries_admin"  ON daybook_entries FOR ALL
  USING (is_org_admin(org_id));

-- ── compliance_checks ────────────────────────────────────────
CREATE POLICY "compliance_checks_select" ON compliance_checks FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "compliance_checks_admin"  ON compliance_checks FOR ALL
  USING (is_org_admin(org_id));

-- ── public_holidays ──────────────────────────────────────────
CREATE POLICY "public_holidays_system" ON public_holidays FOR SELECT
  USING (org_id IS NULL);
CREATE POLICY "public_holidays_org"    ON public_holidays FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "public_holidays_admin"  ON public_holidays FOR ALL
  USING (is_org_admin(org_id));

-- ── chart_of_accounts ────────────────────────────────────────
CREATE POLICY "chart_of_accounts_select" ON chart_of_accounts FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "chart_of_accounts_admin"  ON chart_of_accounts FOR ALL
  USING (is_org_admin(org_id));

-- ── audit_log ────────────────────────────────────────────────
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "audit_log_admin"  ON audit_log FOR ALL
  USING (is_org_admin(org_id));

-- ── admin_data_jobs / admin_data_audit (audit fix H1) ────────
DROP POLICY IF EXISTS "Allow all operations on admin_data_jobs"  ON admin_data_jobs;
DROP POLICY IF EXISTS "Allow all operations on admin_data_audit" ON admin_data_audit;
CREATE POLICY "admin_data_jobs_org_admin_only" ON admin_data_jobs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = (SELECT auth.uid())
      AND role IN ('owner','manager') AND is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = (SELECT auth.uid())
      AND role IN ('owner','manager') AND is_active = true
  ));
CREATE POLICY "admin_data_audit_org_admin_only" ON admin_data_audit FOR ALL
  USING (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = (SELECT auth.uid())
      AND role IN ('owner','manager') AND is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM org_members WHERE user_id = (SELECT auth.uid())
      AND role IN ('owner','manager') AND is_active = true
  ));

-- ── invoices ─────────────────────────────────────────────────
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (org_id IN (SELECT get_user_org_ids()));

-- ── invoice_line_items ───────────────────────────────────────
CREATE POLICY "invoice_line_items_select" ON invoice_line_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "invoice_line_items_insert" ON invoice_line_items FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "invoice_line_items_update" ON invoice_line_items FOR UPDATE
  USING (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "invoice_line_items_delete" ON invoice_line_items FOR DELETE
  USING (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));

-- ── reconciliation_logs ──────────────────────────────────────
CREATE POLICY "reconciliation_logs_select" ON reconciliation_logs FOR SELECT
  USING (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "reconciliation_logs_insert" ON reconciliation_logs FOR INSERT
  WITH CHECK (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "reconciliation_logs_update" ON reconciliation_logs FOR UPDATE
  USING (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "reconciliation_logs_delete" ON reconciliation_logs FOR DELETE
  USING (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));

-- ── reconciliation_line_items ────────────────────────────────
CREATE POLICY "recon_line_items_select" ON reconciliation_line_items FOR SELECT
  USING (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));
CREATE POLICY "recon_line_items_insert" ON reconciliation_line_items FOR INSERT
  WITH CHECK (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));
CREATE POLICY "recon_line_items_update" ON reconciliation_line_items FOR UPDATE
  USING (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));
CREATE POLICY "recon_line_items_delete" ON reconciliation_line_items FOR DELETE
  USING (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));

-- ── xero_connections ─────────────────────────────────────────
CREATE POLICY "xero_connections_select" ON xero_connections FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "xero_connections_insert" ON xero_connections FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "xero_connections_update" ON xero_connections FOR UPDATE
  USING (is_org_admin(org_id));
CREATE POLICY "xero_connections_delete" ON xero_connections FOR DELETE
  USING (is_org_admin(org_id));

-- ── xero_sync_log ────────────────────────────────────────────
CREATE POLICY "xero_sync_log_select" ON xero_sync_log FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "xero_sync_log_insert" ON xero_sync_log FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "xero_sync_log_update" ON xero_sync_log FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));

-- ── xero_account_mappings ────────────────────────────────────
CREATE POLICY "xero_account_mappings_select" ON xero_account_mappings FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "xero_account_mappings_insert" ON xero_account_mappings FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "xero_account_mappings_update" ON xero_account_mappings FOR UPDATE
  USING (is_org_admin(org_id));
CREATE POLICY "xero_account_mappings_delete" ON xero_account_mappings FOR DELETE
  USING (is_org_admin(org_id));

-- ── square_catalog_mappings ──────────────────────────────────
CREATE POLICY "square_catalog_mappings_select" ON square_catalog_mappings FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "square_catalog_mappings_insert" ON square_catalog_mappings FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "square_catalog_mappings_update" ON square_catalog_mappings FOR UPDATE
  USING (is_org_admin(org_id));
CREATE POLICY "square_catalog_mappings_delete" ON square_catalog_mappings FOR DELETE
  USING (is_org_admin(org_id));

-- ── square_modifier_mappings ─────────────────────────────────
CREATE POLICY "square_modifier_mappings_select" ON square_modifier_mappings FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "square_modifier_mappings_insert" ON square_modifier_mappings FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "square_modifier_mappings_update" ON square_modifier_mappings FOR UPDATE
  USING (is_org_admin(org_id));
CREATE POLICY "square_modifier_mappings_delete" ON square_modifier_mappings FOR DELETE
  USING (is_org_admin(org_id));

-- ── stock_depletion_queue ────────────────────────────────────
CREATE POLICY "stock_depletion_queue_select" ON stock_depletion_queue FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "stock_depletion_queue_insert" ON stock_depletion_queue FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "stock_depletion_queue_update" ON stock_depletion_queue FOR UPDATE
  USING (is_org_admin(org_id));
CREATE POLICY "stock_depletion_queue_delete" ON stock_depletion_queue FOR DELETE
  USING (is_org_admin(org_id));

-- ── stock_movements (append-only, no client writes) ──────────
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
-- INSERT handled by service role via API — no client INSERT policy intentional

-- ── demand_forecasts ─────────────────────────────────────────
CREATE POLICY "demand_forecasts_select" ON demand_forecasts FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "demand_forecasts_insert" ON demand_forecasts FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "demand_forecasts_update" ON demand_forecasts FOR UPDATE
  USING (is_org_admin(org_id));
CREATE POLICY "demand_forecasts_delete" ON demand_forecasts FOR DELETE
  USING (is_org_admin(org_id));

-- ── supplier_lead_time_logs ──────────────────────────────────
CREATE POLICY "supplier_lead_time_logs_select" ON supplier_lead_time_logs FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "supplier_lead_time_logs_insert" ON supplier_lead_time_logs FOR INSERT
  WITH CHECK (is_org_admin(org_id));
CREATE POLICY "supplier_lead_time_logs_update" ON supplier_lead_time_logs FOR UPDATE
  USING (is_org_admin(org_id));


-- ════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION get_user_org_ids()                      TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin(UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_current_stock(UUID, UUID)     TO authenticated;


-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKET
-- ════════════════════════════════════════════════════════════

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('invoices', 'invoices', false, 20971520,
    ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
  ON CONFLICT (id) DO NOTHING;
END $$;

DROP POLICY IF EXISTS "invoices_storage_select" ON storage.objects;
CREATE POLICY "invoices_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id IN (SELECT get_user_org_ids())
  ));

DROP POLICY IF EXISTS "invoices_storage_insert" ON storage.objects;
CREATE POLICY "invoices_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id IN (SELECT get_user_org_ids())
  ));

DROP POLICY IF EXISTS "invoices_storage_delete" ON storage.objects;
CREATE POLICY "invoices_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id IN (SELECT get_user_org_ids())
  ));


-- ════════════════════════════════════════════════════════════
-- REFERENCE DATA: Public Holidays (AU 2025-2026)
-- ════════════════════════════════════════════════════════════

INSERT INTO public_holidays (name, date, is_national) VALUES
  ('New Year''s Day',                    '2025-01-01', true),
  ('Australia Day',                      '2025-01-27', true),
  ('Good Friday',                        '2025-04-18', true),
  ('Saturday before Easter Sunday',      '2025-04-19', true),
  ('Easter Sunday',                      '2025-04-20', true),
  ('Easter Monday',                      '2025-04-21', true),
  ('Anzac Day',                          '2025-04-25', true),
  ('Queen''s Birthday',                  '2025-06-09', true),
  ('Christmas Day',                      '2025-12-25', true),
  ('Boxing Day',                         '2025-12-26', true),
  ('New Year''s Day',                    '2026-01-01', true),
  ('Australia Day',                      '2026-01-26', true),
  ('Good Friday',                        '2026-04-03', true),
  ('Saturday before Easter Sunday',      '2026-04-04', true),
  ('Easter Sunday',                      '2026-04-05', true),
  ('Easter Monday',                      '2026-04-06', true),
  ('Anzac Day',                          '2026-04-25', true),
  ('Queen''s Birthday',                  '2026-06-08', true),
  ('Christmas Day',                      '2026-12-25', true),
  ('Boxing Day',                         '2026-12-26', true)
ON CONFLICT DO NOTHING;

INSERT INTO public_holidays (name, date, state) VALUES
  ('Melbourne Cup Day',       '2025-11-04', 'VIC'),
  ('AFL Grand Final Friday',  '2025-09-26', 'VIC'),
  ('Bank Holiday',            '2025-08-04', 'NSW'),
  ('Royal Queensland Show',   '2025-08-13', 'QLD'),
  ('Adelaide Cup',            '2025-03-10', 'SA'),
  ('Proclamation Day',        '2025-12-24', 'SA'),
  ('Western Australia Day',   '2025-06-02', 'WA'),
  ('Royal Hobart Regatta',    '2025-02-10', 'TAS'),
  ('Canberra Day',            '2025-03-10', 'ACT'),
  ('Reconciliation Day',      '2025-05-26', 'ACT'),
  ('Family & Community Day',  '2025-09-29', 'ACT'),
  ('May Day',                 '2025-05-05', 'NT'),
  ('Show Day',                '2025-07-11', 'NT'),
  ('Picnic Day',              '2025-08-04', 'NT'),
  ('Melbourne Cup Day',       '2026-11-03', 'VIC'),
  ('AFL Grand Final Friday',  '2026-09-25', 'VIC'),
  ('Bank Holiday',            '2026-08-03', 'NSW'),
  ('Royal Queensland Show',   '2026-08-12', 'QLD'),
  ('Adelaide Cup',            '2026-03-09', 'SA'),
  ('Proclamation Day',        '2026-12-24', 'SA'),
  ('Western Australia Day',   '2026-06-01', 'WA'),
  ('Canberra Day',            '2026-03-09', 'ACT'),
  ('Reconciliation Day',      '2026-05-25', 'ACT'),
  ('Family & Community Day',  '2026-09-28', 'ACT')
ON CONFLICT DO NOTHING;
