-- SuperSol MVP Database Schema
-- Based on MVP Feature List specification
-- Multi-org, multi-venue tenancy with RBAC

-- ============================================
-- 1. CORE: Organizations & Venues
-- ============================================

-- Organizations (top-level tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT, -- Australian Business Number
  legal_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,

  -- Settings
  timezone TEXT NOT NULL DEFAULT 'Australia/Melbourne',
  currency TEXT NOT NULL DEFAULT 'AUD',
  week_starts_on INTEGER NOT NULL DEFAULT 1, -- 1 = Monday
  gst_registered BOOLEAN NOT NULL DEFAULT true,
  gst_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10, -- 10% GST
  default_gp_target DECIMAL(5,4) NOT NULL DEFAULT 0.65, -- 65% GP target
  pricing_mode TEXT NOT NULL DEFAULT 'gst_inclusive' CHECK (pricing_mode IN ('gst_inclusive', 'gst_exclusive')),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,

  CONSTRAINT valid_gst_rate CHECK (gst_rate >= 0 AND gst_rate <= 1),
  CONSTRAINT valid_gp_target CHECK (default_gp_target >= 0 AND default_gp_target <= 1)
);

-- Venues/Sites (locations within an organization)
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  venue_type TEXT NOT NULL DEFAULT 'restaurant' CHECK (venue_type IN ('restaurant', 'cafe', 'bar', 'food_truck', 'catering', 'other')),

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  country TEXT DEFAULT 'Australia',

  -- Contact
  phone TEXT,
  email TEXT,

  -- Operating details
  timezone TEXT NOT NULL DEFAULT 'Australia/Melbourne',
  trading_hours JSONB, -- { "mon": { "open": "07:00", "close": "17:00" }, ... }

  -- Settings (can override org defaults)
  gst_registered BOOLEAN,
  default_gp_target DECIMAL(5,4),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_venues_org ON venues(org_id);

-- ============================================
-- 2. USERS & RBAC
-- ============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  avatar_url TEXT,

  -- Preferences
  timezone TEXT DEFAULT 'Australia/Melbourne',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization memberships (users can belong to multiple orgs)
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- RBAC role
  role TEXT NOT NULL DEFAULT 'crew' CHECK (role IN ('owner', 'manager', 'supervisor', 'crew')),

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);

-- Venue access (which venues can a user access within their org)
CREATE TABLE IF NOT EXISTS venue_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- Can override org-level role for specific venues
  role_override TEXT CHECK (role_override IN ('manager', 'supervisor', 'crew')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_member_id, venue_id)
);

-- ============================================
-- 3. SUPPLIERS & INGREDIENTS
-- ============================================

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  code TEXT, -- Internal supplier code
  abn TEXT,
  is_gst_registered BOOLEAN DEFAULT true,

  -- Contact
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,

  -- Payment terms
  payment_terms TEXT DEFAULT 'net_30' CHECK (payment_terms IN ('cod', 'net_7', 'net_14', 'net_30', 'net_60', 'eom')),
  credit_limit DECIMAL(12,2),

  -- Ordering
  order_channel TEXT DEFAULT 'email' CHECK (order_channel IN ('email', 'phone', 'portal', 'app', 'other')),
  order_email TEXT,
  order_phone TEXT,
  min_order_value DECIMAL(12,2),

  -- Delivery
  lead_time_days INTEGER DEFAULT 1,
  delivery_days JSONB, -- ["mon", "wed", "fri"]

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_suppliers_org ON suppliers(org_id);

-- Ingredients / Stock Items
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  sku TEXT, -- Internal SKU
  supplier_code TEXT, -- Supplier's product code
  barcode TEXT,

  -- Category
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('meat', 'seafood', 'dairy', 'produce', 'dry_goods', 'beverages', 'alcohol', 'packaging', 'cleaning', 'other')),
  subcategory TEXT,

  -- Units
  purchase_unit TEXT NOT NULL DEFAULT 'each', -- How we buy it (case, kg, L, each)
  purchase_unit_qty DECIMAL(10,4) DEFAULT 1, -- Units per purchase (e.g., 12 per case)
  recipe_unit TEXT NOT NULL DEFAULT 'g', -- How recipes use it (g, ml, each)
  conversion_factor DECIMAL(12,6) DEFAULT 1, -- recipe_units per purchase_unit

  -- Cost
  unit_cost DECIMAL(12,4) NOT NULL DEFAULT 0, -- Cost per purchase_unit (ex GST)
  is_gst_free BOOLEAN DEFAULT false,
  last_cost_update TIMESTAMPTZ,

  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  par_level DECIMAL(12,4), -- Reorder when below this
  reorder_qty DECIMAL(12,4), -- How much to reorder

  -- Waste
  default_waste_percent DECIMAL(5,4) DEFAULT 0, -- e.g., 0.05 for 5% trim waste

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Allergens (FSANZ)
  allergens TEXT[], -- ['gluten', 'dairy', 'nuts', etc.]

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_ingredients_org ON ingredients(org_id);
CREATE INDEX idx_ingredients_supplier ON ingredients(supplier_id);
CREATE INDEX idx_ingredients_category ON ingredients(category);

-- ============================================
-- 4. RECIPES & MENU ITEMS
-- ============================================

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  code TEXT, -- Internal recipe code
  category TEXT NOT NULL DEFAULT 'food' CHECK (category IN ('food', 'beverage', 'component')),

  -- Description
  description TEXT,
  method TEXT, -- Preparation method

  -- Yield
  batch_yield DECIMAL(10,4) NOT NULL DEFAULT 1, -- How many serves per batch
  serve_unit TEXT DEFAULT 'portion', -- portion, ml, g, each
  serve_size DECIMAL(10,4) DEFAULT 1,

  -- Cost (calculated from ingredients)
  cost_per_batch DECIMAL(12,4) DEFAULT 0,
  cost_per_serve DECIMAL(12,4) DEFAULT 0,

  -- Waste allowance
  waste_percent DECIMAL(5,4) DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER DEFAULT 1,

  -- Allergens (aggregated from ingredients)
  allergens TEXT[],

  -- Times
  prep_time_mins INTEGER,
  cook_time_mins INTEGER,

  -- Images
  image_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_recipes_org ON recipes(org_id);

-- Recipe Ingredients (links recipes to ingredients)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,

  quantity DECIMAL(12,4) NOT NULL, -- In recipe_unit of the ingredient
  unit TEXT NOT NULL, -- Should match ingredient.recipe_unit

  -- For sub-recipes
  is_sub_recipe BOOLEAN DEFAULT false,
  sub_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,

  -- Cost (calculated)
  cost DECIMAL(12,4) DEFAULT 0,

  -- Order in recipe
  sort_order INTEGER DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);

-- Menu Sections
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

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  section_id UUID REFERENCES menu_sections(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- Pricing
  sell_price DECIMAL(12,2) NOT NULL DEFAULT 0, -- Sell price
  is_price_gst_inclusive BOOLEAN DEFAULT true,

  -- Cost (from recipe or manual)
  cost_per_serve DECIMAL(12,4) DEFAULT 0,
  use_recipe_cost BOOLEAN DEFAULT true, -- If false, use manual cost

  -- GP
  gp_percent DECIMAL(5,4) DEFAULT 0, -- Calculated: (price - cost) / price

  -- POS
  pos_item_id TEXT, -- ID in POS system (Square)
  pos_item_name TEXT,

  -- Category
  category TEXT,
  tags TEXT[], -- ['vegetarian', 'gluten-free', etc.]
  allergens TEXT[],

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true, -- Currently selling

  -- Display
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_menu_items_org ON menu_items(org_id);
CREATE INDEX idx_menu_items_recipe ON menu_items(recipe_id);
CREATE INDEX idx_menu_items_pos ON menu_items(pos_item_id);

-- ============================================
-- 5. PURCHASING & INVENTORY
-- ============================================

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- PO Details
  po_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'partially_received', 'received', 'cancelled')),

  -- Dates
  order_date DATE,
  expected_delivery DATE,
  actual_delivery DATE,

  -- Totals
  subtotal DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,

  -- Delivery
  delivery_notes TEXT,

  -- Approval
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  submitted_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX idx_purchase_orders_org ON purchase_orders(org_id);
CREATE INDEX idx_purchase_orders_venue ON purchase_orders(venue_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);

-- Purchase Order Line Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,

  -- Ordered
  quantity_ordered DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  unit_cost DECIMAL(12,4) NOT NULL,

  -- Received
  quantity_received DECIMAL(12,4) DEFAULT 0,
  received_at TIMESTAMPTZ,
  received_by UUID REFERENCES profiles(id),

  -- Totals
  line_total DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX idx_po_items_ingredient ON purchase_order_items(ingredient_id);

-- Stock Counts
CREATE TABLE IF NOT EXISTS stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- Count details
  count_type TEXT NOT NULL DEFAULT 'full' CHECK (count_type IN ('full', 'cycle', 'spot')),
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'approved')),

  -- Location
  storage_location TEXT, -- 'cool_room', 'dry_store', 'bar', etc.

  -- Totals
  total_value DECIMAL(12,2) DEFAULT 0,
  variance_value DECIMAL(12,2) DEFAULT 0,

  -- Approval
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_stock_counts_org ON stock_counts(org_id);
CREATE INDEX idx_stock_counts_venue ON stock_counts(venue_id);

-- Stock Count Items
CREATE TABLE IF NOT EXISTS stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,

  -- Counts
  expected_qty DECIMAL(12,4), -- Theoretical from system
  counted_qty DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,

  -- Variance
  variance_qty DECIMAL(12,4) DEFAULT 0,
  variance_value DECIMAL(12,2) DEFAULT 0,
  variance_percent DECIMAL(5,4) DEFAULT 0,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_count_items_count ON stock_count_items(stock_count_id);

-- Waste Logs
CREATE TABLE IF NOT EXISTS waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,

  -- Waste details
  waste_date DATE NOT NULL DEFAULT CURRENT_DATE,
  waste_type TEXT NOT NULL CHECK (waste_type IN ('spoilage', 'breakage', 'over_production', 'prep_waste', 'staff_meal', 'promo', 'other')),

  quantity DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  cost_value DECIMAL(12,2) DEFAULT 0,

  -- Reason
  reason TEXT,
  photo_url TEXT,

  -- Approval (for high-value waste)
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_waste_logs_org ON waste_logs(org_id);
CREATE INDEX idx_waste_logs_venue ON waste_logs(venue_id);
CREATE INDEX idx_waste_logs_date ON waste_logs(waste_date);

-- Current Stock Levels (per venue)
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

CREATE INDEX idx_stock_levels_venue ON stock_levels(venue_id);

-- ============================================
-- 6. STAFF & ONBOARDING
-- ============================================

-- Staff Profiles (extends org_members for employment details)
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id UUID NOT NULL REFERENCES org_members(id) ON DELETE CASCADE,

  -- Personal
  date_of_birth DATE,
  gender TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,

  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,

  -- Employment
  employment_type TEXT NOT NULL DEFAULT 'casual' CHECK (employment_type IN ('full_time', 'part_time', 'casual')),
  position TEXT, -- 'Kitchen', 'Bar', 'FOH', etc.
  award_classification TEXT, -- e.g., 'Restaurant Industry Award - Level 2'
  base_hourly_rate DECIMAL(10,2),

  start_date DATE,
  end_date DATE,

  -- Tax & Super (AU)
  tfn_provided BOOLEAN DEFAULT false,
  tfn_declaration_date DATE,
  super_fund_name TEXT,
  super_fund_abn TEXT,
  super_member_number TEXT,

  -- Bank
  bank_bsb TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,

  -- Status
  onboarding_status TEXT NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'in_progress', 'completed', 'roster_ready')),

  -- Time & Attendance
  pin_code TEXT, -- 4-digit PIN for clock-in

  -- Documents
  id_verified BOOLEAN DEFAULT false,
  contract_signed BOOLEAN DEFAULT false,
  contract_signed_at TIMESTAMPTZ,
  fwis_acknowledged BOOLEAN DEFAULT false, -- Fair Work Information Statement
  fwis_acknowledged_at TIMESTAMPTZ,
  policies_acknowledged BOOLEAN DEFAULT false,
  policies_acknowledged_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_org_member ON staff(org_member_id);

-- Onboarding Invites
CREATE TABLE IF NOT EXISTS onboarding_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- Invite details
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,

  -- Token
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Employment
  position TEXT,
  employment_type TEXT DEFAULT 'casual',
  base_hourly_rate DECIMAL(10,2),
  planned_start_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'in_progress', 'completed', 'expired', 'cancelled')),

  -- Linked records
  staff_id UUID REFERENCES staff(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_onboarding_invites_org ON onboarding_invites(org_id);
CREATE INDEX idx_onboarding_invites_token ON onboarding_invites(token);

-- Staff Documents
CREATE TABLE IF NOT EXISTS staff_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  document_type TEXT NOT NULL CHECK (document_type IN ('id', 'visa', 'contract', 'tfn_declaration', 'super_choice', 'rsa', 'food_safety', 'police_check', 'wwcc', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Expiry
  expires_at DATE,
  expiry_reminded BOOLEAN DEFAULT false,

  -- Verification
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_staff_documents_staff ON staff_documents(staff_id);

-- ============================================
-- 7. ROSTER & TIMESHEETS
-- ============================================

-- Roster Shifts
CREATE TABLE IF NOT EXISTS roster_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- Shift details
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_mins INTEGER DEFAULT 0,

  -- Role/Position
  position TEXT, -- 'Kitchen', 'Bar', 'FOH'

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'confirmed', 'completed', 'cancelled')),

  -- Costing
  hourly_rate DECIMAL(10,2),
  penalty_rate DECIMAL(5,4) DEFAULT 1, -- Multiplier (1.25 for Saturday, 1.5 for Sunday, etc.)
  estimated_cost DECIMAL(10,2) DEFAULT 0,

  -- Notes
  notes TEXT,

  -- Publishing
  published_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_roster_shifts_org ON roster_shifts(org_id);
CREATE INDEX idx_roster_shifts_venue ON roster_shifts(venue_id);
CREATE INDEX idx_roster_shifts_staff ON roster_shifts(staff_id);
CREATE INDEX idx_roster_shifts_date ON roster_shifts(shift_date);

-- Timesheets (actual worked hours)
CREATE TABLE IF NOT EXISTS timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  roster_shift_id UUID REFERENCES roster_shifts(id) ON DELETE SET NULL,

  -- Work date
  work_date DATE NOT NULL,

  -- Clock times
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,

  -- Breaks
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  total_break_mins INTEGER DEFAULT 0,

  -- Calculated
  total_hours DECIMAL(5,2) DEFAULT 0,

  -- Geo-location
  clock_in_lat DECIMAL(10,8),
  clock_in_lng DECIMAL(11,8),
  clock_out_lat DECIMAL(10,8),
  clock_out_lng DECIMAL(11,8),
  clock_in_method TEXT DEFAULT 'app' CHECK (clock_in_method IN ('app', 'pin', 'manual')),

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved', 'rejected', 'exported')),

  -- Payroll
  hourly_rate DECIMAL(10,2),
  penalty_rate DECIMAL(5,4) DEFAULT 1,
  overtime_hours DECIMAL(5,2) DEFAULT 0,
  total_pay DECIMAL(10,2) DEFAULT 0,

  -- Approval
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Edits
  edited BOOLEAN DEFAULT false,
  edit_reason TEXT,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timesheets_org ON timesheets(org_id);
CREATE INDEX idx_timesheets_venue ON timesheets(venue_id);
CREATE INDEX idx_timesheets_staff ON timesheets(staff_id);
CREATE INDEX idx_timesheets_date ON timesheets(work_date);
CREATE INDEX idx_timesheets_status ON timesheets(status);

-- Staff Availability
CREATE TABLE IF NOT EXISTS staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- Day of week (0=Sunday, 1=Monday, etc.)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Availability
  is_available BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,

  -- Approval
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(staff_id, day_of_week)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- Leave details
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'personal', 'unpaid', 'long_service', 'compassionate', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Notes
  reason TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  -- Approval
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_leave_requests_staff ON leave_requests(staff_id);

-- ============================================
-- 8. SALES & POS
-- ============================================

-- POS Connections
CREATE TABLE IF NOT EXISTS pos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Provider
  provider TEXT NOT NULL DEFAULT 'square' CHECK (provider IN ('square', 'lightspeed', 'kounta', 'other')),

  -- Credentials (encrypted)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Merchant/Location info from POS
  merchant_id TEXT,
  merchant_name TEXT,

  -- Sync settings
  sync_frequency TEXT DEFAULT 'hourly' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily')),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  sync_from_date DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_pos_connections_org ON pos_connections(org_id);

-- POS Location Mappings (map POS locations to venues)
CREATE TABLE IF NOT EXISTS pos_location_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_connection_id UUID NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  pos_location_id TEXT NOT NULL, -- ID in POS system
  pos_location_name TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(pos_connection_id, pos_location_id)
);

-- Sales Transactions
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- POS reference
  pos_connection_id UUID REFERENCES pos_connections(id),
  pos_transaction_id TEXT, -- ID in POS system

  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_time TIME NOT NULL,
  transaction_at TIMESTAMPTZ NOT NULL,

  -- Type
  transaction_type TEXT NOT NULL DEFAULT 'sale' CHECK (transaction_type IN ('sale', 'refund', 'void')),
  order_type TEXT DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery', 'online')),

  -- Totals
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,

  -- Items
  item_count INTEGER DEFAULT 0,

  -- Payment
  payment_method TEXT, -- 'cash', 'card', 'digital_wallet'

  -- Customer
  customer_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX idx_sales_transactions_org ON sales_transactions(org_id);
CREATE INDEX idx_sales_transactions_venue ON sales_transactions(venue_id);
CREATE INDEX idx_sales_transactions_date ON sales_transactions(transaction_date);
CREATE INDEX idx_sales_transactions_pos ON sales_transactions(pos_transaction_id);

-- Sales Transaction Items
CREATE TABLE IF NOT EXISTS sales_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,

  -- POS reference
  pos_item_id TEXT,

  -- Item details
  name TEXT NOT NULL,
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,

  -- Modifiers/variations
  modifiers JSONB,

  -- Totals
  discount_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,

  -- Cost (for GP calculation)
  cost_per_unit DECIMAL(12,4) DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_items_transaction ON sales_transaction_items(transaction_id);
CREATE INDEX idx_sales_items_menu_item ON sales_transaction_items(menu_item_id);

-- ============================================
-- 9. DAYBOOK & OPERATIONS
-- ============================================

-- Daybook Entries
CREATE TABLE IF NOT EXISTS daybook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  entry_date DATE NOT NULL,

  -- Sales reconciliation
  pos_sales DECIMAL(12,2) DEFAULT 0, -- From POS sync
  cash_counted DECIMAL(12,2) DEFAULT 0,
  card_total DECIMAL(12,2) DEFAULT 0,
  variance DECIMAL(12,2) DEFAULT 0,

  -- Notes
  notes TEXT,
  issues TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved')),

  -- Approval
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_daybook_entries_venue ON daybook_entries(venue_id);
CREATE INDEX idx_daybook_entries_date ON daybook_entries(entry_date);

-- Compliance Checks
CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  check_type TEXT NOT NULL, -- 'food_safety', 'opening', 'closing', 'temperature', etc.
  check_date DATE NOT NULL,
  check_time TIME,

  -- Result
  passed BOOLEAN,
  value TEXT, -- e.g., temperature reading

  -- Notes
  notes TEXT,
  photo_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_compliance_checks_venue ON compliance_checks(venue_id);
CREATE INDEX idx_compliance_checks_date ON compliance_checks(check_date);

-- ============================================
-- 10. AUDIT LOG
-- ============================================

-- Audit Log (tracks all changes per MVP spec)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- What changed
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),

  -- Before/After snapshots
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],

  -- Who and when
  user_id UUID REFERENCES profiles(id),
  user_email TEXT,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org ON audit_log(org_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- 11. CHART OF ACCOUNTS (for Xero/MYOB mapping)
-- ============================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Internal category
  category TEXT NOT NULL CHECK (category IN ('revenue', 'cogs', 'labour', 'overhead', 'other')),
  subcategory TEXT, -- 'food_sales', 'beverage_sales', 'food_cost', etc.

  -- External mapping
  external_system TEXT DEFAULT 'xero' CHECK (external_system IN ('xero', 'myob', 'quickbooks')),
  external_account_id TEXT,
  external_account_name TEXT,
  external_account_code TEXT,

  -- Settings
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coa_org ON chart_of_accounts(org_id);

-- ============================================
-- 12. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'organizations', 'venues', 'profiles', 'org_members',
      'suppliers', 'ingredients', 'recipes', 'menu_items', 'menu_sections',
      'purchase_orders', 'stock_counts', 'staff', 'roster_shifts',
      'timesheets', 'staff_availability', 'daybook_entries',
      'pos_connections', 'chart_of_accounts'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to calculate recipe cost
CREATE OR REPLACE FUNCTION calculate_recipe_cost(p_recipe_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_cost DECIMAL(12,4);
  v_batch_yield DECIMAL(10,4);
  v_waste_percent DECIMAL(5,4);
BEGIN
  -- Get recipe details
  SELECT batch_yield, COALESCE(waste_percent, 0)
  INTO v_batch_yield, v_waste_percent
  FROM recipes WHERE id = p_recipe_id;

  -- Calculate total ingredient cost
  SELECT COALESCE(SUM(
    ri.quantity * i.unit_cost / NULLIF(i.conversion_factor, 0)
  ), 0)
  INTO v_total_cost
  FROM recipe_ingredients ri
  JOIN ingredients i ON ri.ingredient_id = i.id
  WHERE ri.recipe_id = p_recipe_id;

  -- Update recipe with calculated costs
  UPDATE recipes
  SET
    cost_per_batch = v_total_cost * (1 + v_waste_percent),
    cost_per_serve = (v_total_cost * (1 + v_waste_percent)) / NULLIF(v_batch_yield, 0),
    updated_at = NOW()
  WHERE id = p_recipe_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate menu item GP%
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

-- Enable RLS on all tables
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

-- Helper function to get user's org IDs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is org owner/manager
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

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Organizations: members can view their orgs
CREATE POLICY "Members can view their organizations" ON organizations
  FOR SELECT USING (id IN (SELECT get_user_org_ids()));
CREATE POLICY "Owners can update organization" ON organizations
  FOR UPDATE USING (is_org_admin(id));

-- Venues: members can view venues in their orgs
CREATE POLICY "Members can view venues" ON venues
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage venues" ON venues
  FOR ALL USING (is_org_admin(org_id));

-- Org members: can view members in same org
CREATE POLICY "View org members" ON org_members
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage members" ON org_members
  FOR ALL USING (is_org_admin(org_id));

-- Apply similar policies to other tables (org-scoped access)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'suppliers', 'ingredients', 'recipes', 'menu_sections', 'menu_items',
      'purchase_orders', 'stock_counts', 'waste_logs', 'staff',
      'onboarding_invites', 'roster_shifts', 'timesheets', 'daybook_entries',
      'compliance_checks', 'pos_connections', 'sales_transactions',
      'chart_of_accounts', 'audit_log'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Members can view %s" ON %s;
      CREATE POLICY "Members can view %s" ON %s
        FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));

      DROP POLICY IF EXISTS "Admins can manage %s" ON %s;
      CREATE POLICY "Admins can manage %s" ON %s
        FOR ALL USING (is_org_admin(org_id));
    ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Special policies for child tables (using parent org_id)

-- Recipe ingredients: based on recipe access
CREATE POLICY "Access recipe ingredients" ON recipe_ingredients
  FOR ALL USING (
    recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- Purchase order items: based on PO access
CREATE POLICY "Access PO items" ON purchase_order_items
  FOR ALL USING (
    po_id IN (SELECT id FROM purchase_orders WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- Stock count items: based on stock count access
CREATE POLICY "Access stock count items" ON stock_count_items
  FOR ALL USING (
    stock_count_id IN (SELECT id FROM stock_counts WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- Staff documents: based on staff access
CREATE POLICY "Access staff documents" ON staff_documents
  FOR ALL USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON s.org_member_id = om.id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );

-- Sales transaction items: based on transaction access
CREATE POLICY "Access sales items" ON sales_transaction_items
  FOR ALL USING (
    transaction_id IN (SELECT id FROM sales_transactions WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- Venue access: based on org membership
CREATE POLICY "Access venue permissions" ON venue_access
  FOR ALL USING (
    org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- Stock levels: based on venue access
CREATE POLICY "Access stock levels" ON stock_levels
  FOR ALL USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- POS location mappings: based on POS connection
CREATE POLICY "Access POS mappings" ON pos_location_mappings
  FOR ALL USING (
    pos_connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- Staff availability: based on staff access
CREATE POLICY "Access staff availability" ON staff_availability
  FOR ALL USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON s.org_member_id = om.id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );

-- Leave requests: based on staff access
CREATE POLICY "Access leave requests" ON leave_requests
  FOR ALL USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON s.org_member_id = om.id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );

-- ============================================
-- Done! Schema ready for SuperSol MVP
-- ============================================
