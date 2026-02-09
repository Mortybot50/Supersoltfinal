-- SuperSol MVP Database Schema (FIXED)
-- Run this after dropping all tables or on a fresh database

-- ============================================
-- 1. CORE: Organizations & Venues
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT,
  legal_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'Australia/Melbourne',
  currency TEXT NOT NULL DEFAULT 'AUD',
  week_starts_on INTEGER NOT NULL DEFAULT 1,
  gst_registered BOOLEAN NOT NULL DEFAULT true,
  gst_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  default_gp_target DECIMAL(5,4) NOT NULL DEFAULT 0.65,
  pricing_mode TEXT NOT NULL DEFAULT 'gst_inclusive' CHECK (pricing_mode IN ('gst_inclusive', 'gst_exclusive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venue_type TEXT NOT NULL DEFAULT 'restaurant' CHECK (venue_type IN ('restaurant', 'cafe', 'bar', 'food_truck', 'catering', 'other')),
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'Australia',
  phone TEXT,
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'Australia/Melbourne',
  trading_hours JSONB,
  gst_registered BOOLEAN,
  default_gp_target DECIMAL(5,4),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_venues_org ON venues(org_id);

-- ============================================
-- 2. USERS & RBAC
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'Australia/Melbourne',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'crew' CHECK (role IN ('owner', 'manager', 'supervisor', 'crew')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

CREATE TABLE IF NOT EXISTS venue_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  role_override TEXT CHECK (role_override IN ('manager', 'supervisor', 'crew')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_member_id, venue_id)
);

-- ============================================
-- 3. SUPPLIERS & INGREDIENTS
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  abn TEXT,
  is_gst_registered BOOLEAN DEFAULT true,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  payment_terms TEXT DEFAULT 'net_30' CHECK (payment_terms IN ('cod', 'net_7', 'net_14', 'net_30', 'net_60', 'eom')),
  credit_limit DECIMAL(12,2),
  order_channel TEXT DEFAULT 'email' CHECK (order_channel IN ('email', 'phone', 'portal', 'app', 'other')),
  order_email TEXT,
  order_phone TEXT,
  min_order_value DECIMAL(12,2),
  lead_time_days INTEGER DEFAULT 1,
  delivery_days JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id);

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  supplier_code TEXT,
  barcode TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('meat', 'seafood', 'dairy', 'produce', 'dry_goods', 'beverages', 'alcohol', 'packaging', 'cleaning', 'other')),
  subcategory TEXT,
  purchase_unit TEXT NOT NULL DEFAULT 'each',
  purchase_unit_qty DECIMAL(10,4) DEFAULT 1,
  recipe_unit TEXT NOT NULL DEFAULT 'g',
  conversion_factor DECIMAL(12,6) DEFAULT 1,
  unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  is_gst_free BOOLEAN DEFAULT false,
  last_cost_update TIMESTAMPTZ,
  track_inventory BOOLEAN DEFAULT true,
  par_level DECIMAL(12,4),
  reorder_qty DECIMAL(12,4),
  default_waste_percent DECIMAL(5,4) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  allergens TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_ingredients_org ON ingredients(org_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier ON ingredients(supplier_id);

-- ============================================
-- 4. RECIPES & MENU ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  category TEXT NOT NULL DEFAULT 'food' CHECK (category IN ('food', 'beverage', 'component')),
  description TEXT,
  method TEXT,
  batch_yield DECIMAL(10,4) NOT NULL DEFAULT 1,
  serve_unit TEXT DEFAULT 'portion',
  serve_size DECIMAL(10,4) DEFAULT 1,
  cost_per_batch DECIMAL(12,4) DEFAULT 0,
  cost_per_serve DECIMAL(12,4) DEFAULT 0,
  waste_percent DECIMAL(5,4) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER DEFAULT 1,
  allergens TEXT[],
  prep_time_mins INTEGER,
  cook_time_mins INTEGER,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_recipes_org ON recipes(org_id);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  is_sub_recipe BOOLEAN DEFAULT false,
  sub_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  cost DECIMAL(12,4) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS menu_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES menu_sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  sell_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_price_gst_inclusive BOOLEAN DEFAULT true,
  cost_per_serve DECIMAL(12,4) DEFAULT 0,
  use_recipe_cost BOOLEAN DEFAULT true,
  gp_percent DECIMAL(5,4) DEFAULT 0,
  pos_item_id TEXT,
  pos_item_name TEXT,
  category TEXT,
  tags TEXT[],
  allergens TEXT[],
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_menu_items_org ON menu_items(org_id);

-- ============================================
-- 5. PURCHASING & INVENTORY
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'partially_received', 'received', 'cancelled')),
  order_date DATE,
  expected_delivery DATE,
  actual_delivery DATE,
  subtotal DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  delivery_notes TEXT,
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  submitted_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_venue ON purchase_orders(venue_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  quantity_ordered DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  unit_cost DECIMAL(12,4) NOT NULL,
  quantity_received DECIMAL(12,4) DEFAULT 0,
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES profiles(id),
  line_total DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);

CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  count_type TEXT NOT NULL DEFAULT 'full' CHECK (count_type IN ('full', 'cycle', 'spot')),
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'approved')),
  storage_location TEXT,
  total_value DECIMAL(12,2) DEFAULT 0,
  variance_value DECIMAL(12,2) DEFAULT 0,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_counts_org ON stock_counts(org_id);

CREATE TABLE IF NOT EXISTS stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  expected_qty DECIMAL(12,4),
  counted_qty DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  variance_qty DECIMAL(12,4) DEFAULT 0,
  variance_value DECIMAL(12,2) DEFAULT 0,
  variance_percent DECIMAL(5,4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_count_items_count ON stock_count_items(stock_count_id);

CREATE TABLE IF NOT EXISTS waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  waste_date DATE NOT NULL DEFAULT CURRENT_DATE,
  waste_type TEXT NOT NULL CHECK (waste_type IN ('spoilage', 'breakage', 'over_production', 'prep_waste', 'staff_meal', 'promo', 'other')),
  quantity DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  cost_value DECIMAL(12,2) DEFAULT 0,
  reason TEXT,
  photo_url TEXT,
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_waste_logs_org ON waste_logs(org_id);

CREATE TABLE IF NOT EXISTS stock_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_on_hand DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  last_count_date DATE,
  last_count_qty DECIMAL(12,4),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venue_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_levels_venue ON stock_levels(venue_id);

-- ============================================
-- 6. STAFF & ONBOARDING
-- ============================================

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  employment_type TEXT NOT NULL DEFAULT 'casual' CHECK (employment_type IN ('full_time', 'part_time', 'casual')),
  position TEXT,
  award_classification TEXT,
  base_hourly_rate DECIMAL(10,2),
  start_date DATE,
  end_date DATE,
  tfn_provided BOOLEAN DEFAULT false,
  tfn_declaration_date DATE,
  super_fund_name TEXT,
  super_fund_abn TEXT,
  super_member_number TEXT,
  bank_bsb TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed', 'roster_ready')),
  pin_code TEXT,
  id_verified BOOLEAN DEFAULT false,
  contract_signed BOOLEAN DEFAULT false,
  contract_signed_at TIMESTAMPTZ,
  fwis_acknowledged BOOLEAN DEFAULT false,
  fwis_acknowledged_at TIMESTAMPTZ,
  policies_acknowledged BOOLEAN DEFAULT false,
  policies_acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_org_member ON staff(org_member_id);

CREATE TABLE IF NOT EXISTS onboarding_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  position TEXT,
  employment_type TEXT DEFAULT 'casual',
  base_hourly_rate DECIMAL(10,2),
  planned_start_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'in_progress', 'completed', 'expired', 'cancelled')),
  staff_id UUID REFERENCES staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_onboarding_invites_org ON onboarding_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_invites_token ON onboarding_invites(token);

CREATE TABLE IF NOT EXISTS staff_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('id', 'visa', 'contract', 'tfn_declaration', 'super_choice', 'rsa', 'food_safety', 'police_check', 'wwcc', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  expires_at DATE,
  expiry_reminded BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_staff_documents_staff ON staff_documents(staff_id);

-- ============================================
-- 7. ROSTER & TIMESHEETS
-- ============================================

CREATE TABLE IF NOT EXISTS roster_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_mins INTEGER DEFAULT 0,
  position TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'confirmed', 'completed', 'cancelled')),
  hourly_rate DECIMAL(10,2),
  penalty_rate DECIMAL(5,4) DEFAULT 1,
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  published_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_roster_shifts_org ON roster_shifts(org_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_venue ON roster_shifts(venue_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_staff ON roster_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_date ON roster_shifts(shift_date);

CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  roster_shift_id UUID REFERENCES roster_shifts(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  total_break_mins INTEGER DEFAULT 0,
  total_hours DECIMAL(5,2) DEFAULT 0,
  clock_in_lat DECIMAL(10,8),
  clock_in_lng DECIMAL(11,8),
  clock_out_lat DECIMAL(10,8),
  clock_out_lng DECIMAL(11,8),
  clock_in_method TEXT DEFAULT 'app' CHECK (clock_in_method IN ('app', 'pin', 'manual')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved', 'rejected', 'exported')),
  hourly_rate DECIMAL(10,2),
  penalty_rate DECIMAL(5,4) DEFAULT 1,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  total_pay DECIMAL(10,2) DEFAULT 0,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  edited BOOLEAN DEFAULT false,
  edit_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timesheets_org ON timesheets(org_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_venue ON timesheets(venue_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_staff ON timesheets(staff_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(work_date);

CREATE TABLE IF NOT EXISTS staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_available BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'personal', 'unpaid', 'long_service', 'compassionate', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id);

-- ============================================
-- 8. SALES & POS
-- ============================================

CREATE TABLE IF NOT EXISTS pos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'square' CHECK (provider IN ('square', 'lightspeed', 'kounta', 'other')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  merchant_id TEXT,
  merchant_name TEXT,
  sync_frequency TEXT DEFAULT 'hourly' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily')),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  sync_from_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_pos_connections_org ON pos_connections(org_id);

CREATE TABLE IF NOT EXISTS pos_location_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_connection_id UUID NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  pos_location_id TEXT NOT NULL,
  pos_location_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pos_connection_id, pos_location_id)
);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  pos_connection_id UUID REFERENCES pos_connections(id),
  pos_transaction_id TEXT,
  transaction_date DATE NOT NULL,
  transaction_time TIME NOT NULL,
  transaction_at TIMESTAMPTZ NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'sale' CHECK (transaction_type IN ('sale', 'refund', 'void')),
  order_type TEXT DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery', 'online')),
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  payment_method TEXT,
  customer_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_org ON sales_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_venue ON sales_transactions(venue_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(transaction_date);

CREATE TABLE IF NOT EXISTS sales_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  pos_item_id TEXT,
  name TEXT NOT NULL,
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  modifiers JSONB,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,
  cost_per_unit DECIMAL(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_items_transaction ON sales_transaction_items(transaction_id);

-- ============================================
-- 9. DAYBOOK & OPERATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS daybook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  pos_sales DECIMAL(12,2) DEFAULT 0,
  cash_counted DECIMAL(12,2) DEFAULT 0,
  card_total DECIMAL(12,2) DEFAULT 0,
  variance DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  issues TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_daybook_entries_venue ON daybook_entries(venue_id);

CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  check_date DATE NOT NULL,
  check_time TIME,
  passed BOOLEAN,
  value TEXT,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_venue ON compliance_checks(venue_id);

-- ============================================
-- 10. AUDIT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id UUID REFERENCES profiles(id),
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name);

-- ============================================
-- 11. CHART OF ACCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('revenue', 'cogs', 'labour', 'overhead', 'other')),
  subcategory TEXT,
  external_system TEXT DEFAULT 'xero' CHECK (external_system IN ('xero', 'myob', 'quickbooks')),
  external_account_id TEXT,
  external_account_name TEXT,
  external_account_code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coa_org ON chart_of_accounts(org_id);

-- ============================================
-- 12. FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
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
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

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

DROP TRIGGER IF EXISTS calculate_menu_item_gp_trigger ON menu_items;
CREATE TRIGGER calculate_menu_item_gp_trigger
  BEFORE INSERT OR UPDATE OF sell_price, cost_per_serve ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_menu_item_gp();

-- ============================================
-- 13. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_location_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daybook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = p_org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'manager')
    AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Organizations policies
CREATE POLICY "Members can view their organizations" ON organizations FOR SELECT USING (id IN (SELECT get_user_org_ids()));
CREATE POLICY "Owners can update organization" ON organizations FOR UPDATE USING (is_org_admin(id));

-- Venues policies
CREATE POLICY "Members can view venues" ON venues FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage venues" ON venues FOR ALL USING (is_org_admin(org_id));

-- Org members policies
CREATE POLICY "View org members" ON org_members FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage members" ON org_members FOR ALL USING (is_org_admin(org_id));

-- Suppliers policies
CREATE POLICY "Members can view suppliers" ON suppliers FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage suppliers" ON suppliers FOR ALL USING (is_org_admin(org_id));

-- Ingredients policies
CREATE POLICY "Members can view ingredients" ON ingredients FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage ingredients" ON ingredients FOR ALL USING (is_org_admin(org_id));

-- Recipes policies
CREATE POLICY "Members can view recipes" ON recipes FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage recipes" ON recipes FOR ALL USING (is_org_admin(org_id));

-- Recipe ingredients policies
CREATE POLICY "Access recipe ingredients" ON recipe_ingredients FOR ALL USING (
  recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids()))
);

-- Menu sections policies
CREATE POLICY "Members can view menu_sections" ON menu_sections FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage menu_sections" ON menu_sections FOR ALL USING (is_org_admin(org_id));

-- Menu items policies
CREATE POLICY "Members can view menu_items" ON menu_items FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage menu_items" ON menu_items FOR ALL USING (is_org_admin(org_id));

-- Purchase orders policies
CREATE POLICY "Members can view purchase_orders" ON purchase_orders FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage purchase_orders" ON purchase_orders FOR ALL USING (is_org_admin(org_id));

-- PO items policies
CREATE POLICY "Access PO items" ON purchase_order_items FOR ALL USING (
  po_id IN (SELECT id FROM purchase_orders WHERE org_id IN (SELECT get_user_org_ids()))
);

-- Stock counts policies
CREATE POLICY "Members can view stock_counts" ON stock_counts FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage stock_counts" ON stock_counts FOR ALL USING (is_org_admin(org_id));

-- Stock count items policies
CREATE POLICY "Access stock count items" ON stock_count_items FOR ALL USING (
  stock_count_id IN (SELECT id FROM stock_counts WHERE org_id IN (SELECT get_user_org_ids()))
);

-- Waste logs policies
CREATE POLICY "Members can view waste_logs" ON waste_logs FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage waste_logs" ON waste_logs FOR ALL USING (is_org_admin(org_id));

-- Stock levels policies
CREATE POLICY "Access stock levels" ON stock_levels FOR ALL USING (
  venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
);

-- Staff policies (via org_member_id)
CREATE POLICY "Members can view staff" ON staff FOR SELECT USING (
  org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()))
);
CREATE POLICY "Admins can manage staff" ON staff FOR ALL USING (
  org_member_id IN (SELECT om.id FROM org_members om WHERE om.org_id IN (SELECT get_user_org_ids()) AND is_org_admin(om.org_id))
);

-- Onboarding invites policies
CREATE POLICY "Members can view onboarding_invites" ON onboarding_invites FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage onboarding_invites" ON onboarding_invites FOR ALL USING (is_org_admin(org_id));

-- Staff documents policies
CREATE POLICY "Access staff documents" ON staff_documents FOR ALL USING (
  staff_id IN (
    SELECT s.id FROM staff s
    JOIN org_members om ON s.org_member_id = om.id
    WHERE om.org_id IN (SELECT get_user_org_ids())
  )
);

-- Roster shifts policies
CREATE POLICY "Members can view roster_shifts" ON roster_shifts FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage roster_shifts" ON roster_shifts FOR ALL USING (is_org_admin(org_id));

-- Timesheets policies
CREATE POLICY "Members can view timesheets" ON timesheets FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage timesheets" ON timesheets FOR ALL USING (is_org_admin(org_id));

-- Staff availability policies
CREATE POLICY "Access staff availability" ON staff_availability FOR ALL USING (
  staff_id IN (
    SELECT s.id FROM staff s
    JOIN org_members om ON s.org_member_id = om.id
    WHERE om.org_id IN (SELECT get_user_org_ids())
  )
);

-- Leave requests policies
CREATE POLICY "Access leave requests" ON leave_requests FOR ALL USING (
  staff_id IN (
    SELECT s.id FROM staff s
    JOIN org_members om ON s.org_member_id = om.id
    WHERE om.org_id IN (SELECT get_user_org_ids())
  )
);

-- POS connections policies
CREATE POLICY "Members can view pos_connections" ON pos_connections FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage pos_connections" ON pos_connections FOR ALL USING (is_org_admin(org_id));

-- POS location mappings policies
CREATE POLICY "Access POS mappings" ON pos_location_mappings FOR ALL USING (
  pos_connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids()))
);

-- Sales transactions policies
CREATE POLICY "Members can view sales_transactions" ON sales_transactions FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage sales_transactions" ON sales_transactions FOR ALL USING (is_org_admin(org_id));

-- Sales transaction items policies
CREATE POLICY "Access sales items" ON sales_transaction_items FOR ALL USING (
  transaction_id IN (SELECT id FROM sales_transactions WHERE org_id IN (SELECT get_user_org_ids()))
);

-- Daybook entries policies
CREATE POLICY "Members can view daybook_entries" ON daybook_entries FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage daybook_entries" ON daybook_entries FOR ALL USING (is_org_admin(org_id));

-- Compliance checks policies
CREATE POLICY "Members can view compliance_checks" ON compliance_checks FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage compliance_checks" ON compliance_checks FOR ALL USING (is_org_admin(org_id));

-- Audit log policies
CREATE POLICY "Members can view audit_log" ON audit_log FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage audit_log" ON audit_log FOR ALL USING (is_org_admin(org_id));

-- Chart of accounts policies
CREATE POLICY "Members can view chart_of_accounts" ON chart_of_accounts FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage chart_of_accounts" ON chart_of_accounts FOR ALL USING (is_org_admin(org_id));

-- Venue access policies
CREATE POLICY "Access venue permissions" ON venue_access FOR ALL USING (
  org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()))
);

-- Done!
