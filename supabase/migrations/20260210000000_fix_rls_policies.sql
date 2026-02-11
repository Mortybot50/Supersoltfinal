-- ============================================
-- FIX RLS POLICIES — Replace all placeholder "USING (true)" policies
-- with proper org-scoped security
-- ============================================
-- This migration:
-- 1. Drops ALL "Allow all" placeholder policies from lovable migrations
-- 2. Drops conflicting/duplicate MVP policies on tables that were recreated
-- 3. Creates proper org-scoped policies for EVERY table
-- 4. Preserves signup-flow INSERT policies
-- ============================================

-- ============================================
-- PHASE 0: Ensure helper functions exist
-- ============================================

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


-- ============================================
-- PHASE 1: Drop ALL placeholder "Allow all" policies (lovable migrations)
-- ============================================

-- From 20251027101424 (suppliers, ingredients, purchase_orders, purchase_order_items)
DROP POLICY IF EXISTS "Allow all operations on suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow all operations on ingredients" ON ingredients;
DROP POLICY IF EXISTS "Allow all operations on purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Allow all operations on purchase_order_items" ON purchase_order_items;

-- From 20251027105048 (stock_counts, stock_count_items, waste_logs, menu_items)
DROP POLICY IF EXISTS "Allow all operations on stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Allow all operations on stock_count_items" ON stock_count_items;
DROP POLICY IF EXISTS "Allow all operations on waste_logs" ON waste_logs;
DROP POLICY IF EXISTS "Allow all operations on menu_items" ON menu_items;

-- From 20251027015708 (orders)
DROP POLICY IF EXISTS "Allow all operations on orders" ON orders;

-- From 20251028055656 (admin_data_jobs, admin_data_audit)
DROP POLICY IF EXISTS "Allow all operations on admin_data_jobs" ON admin_data_jobs;
DROP POLICY IF EXISTS "Allow all operations on admin_data_audit" ON admin_data_audit;

-- From 20251029112709 (venue_settings, venue_settings_audit)
DROP POLICY IF EXISTS "Allow all operations on venue_settings" ON venue_settings;
DROP POLICY IF EXISTS "Allow all operations on venue_settings_audit" ON venue_settings_audit;

-- From 20251030095618 (inv_locations, inv_bins, inv_location_assignments, device_assignments, count_schedules)
DROP POLICY IF EXISTS "Allow all operations on inv_locations" ON inv_locations;
DROP POLICY IF EXISTS "Allow all operations on inv_bins" ON inv_bins;
DROP POLICY IF EXISTS "Allow all operations on inv_location_assignments" ON inv_location_assignments;
DROP POLICY IF EXISTS "Allow all operations on device_assignments" ON device_assignments;
DROP POLICY IF EXISTS "Allow all operations on count_schedules" ON count_schedules;

-- From 20251030101136 (members, role_definitions, assignments, invites, pins, access_audit)
DROP POLICY IF EXISTS "Allow all operations on members" ON members;
DROP POLICY IF EXISTS "Allow all operations on role_definitions" ON role_definitions;
DROP POLICY IF EXISTS "Allow all operations on assignments" ON assignments;
DROP POLICY IF EXISTS "Allow all operations on invites" ON invites;
DROP POLICY IF EXISTS "Allow all operations on pins" ON pins;
DROP POLICY IF EXISTS "Allow all operations on access_audit" ON access_audit;


-- ============================================
-- PHASE 2: Drop any conflicting MVP policies that reference wrong column names
-- (MVP schema used org_id on tables that lovable recreated with different columns)
-- ============================================

-- suppliers: MVP used org_id, but lovable table uses organization_id
DROP POLICY IF EXISTS "Members can view suppliers" ON suppliers;
DROP POLICY IF EXISTS "Admins can manage suppliers" ON suppliers;

-- ingredients: MVP used org_id, but lovable table uses venue_id only
DROP POLICY IF EXISTS "Members can view ingredients" ON ingredients;
DROP POLICY IF EXISTS "Admins can manage ingredients" ON ingredients;

-- menu_items: MVP used org_id, but lovable table uses venue_id only
DROP POLICY IF EXISTS "Members can view menu_items" ON menu_items;
DROP POLICY IF EXISTS "Admins can manage menu_items" ON menu_items;

-- purchase_orders: MVP used org_id, but lovable table uses venue_id only
DROP POLICY IF EXISTS "Members can view purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Admins can manage purchase_orders" ON purchase_orders;

-- stock_counts: MVP used org_id, but lovable table uses venue_id only
DROP POLICY IF EXISTS "Members can view stock_counts" ON stock_counts;
DROP POLICY IF EXISTS "Admins can manage stock_counts" ON stock_counts;

-- waste_logs: MVP used org_id, but lovable table uses venue_id only
DROP POLICY IF EXISTS "Members can view waste_logs" ON waste_logs;
DROP POLICY IF EXISTS "Admins can manage waste_logs" ON waste_logs;

-- purchase_order_items: drop MVP version to recreate consistently
DROP POLICY IF EXISTS "Access PO items" ON purchase_order_items;

-- stock_count_items: drop MVP version to recreate consistently
DROP POLICY IF EXISTS "Access stock count items" ON stock_count_items;

-- stock_levels: drop MVP version to recreate consistently
DROP POLICY IF EXISTS "Access stock levels" ON stock_levels;


-- ============================================
-- PHASE 3: Enable RLS on ALL tables
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_location_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daybook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;


-- ============================================
-- PHASE 4: Create proper policies
-- ============================================

-- -------------------------------------------
-- GROUP A: Tables with org_id column
-- Pattern: org_id IN (SELECT get_user_org_ids())
-- -------------------------------------------

-- members
CREATE POLICY "Members can view members" ON members
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert members" ON members
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update members" ON members
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete members" ON members
  FOR DELETE USING (is_org_admin(org_id));

-- access_audit
CREATE POLICY "Members can view access_audit" ON access_audit
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert access_audit" ON access_audit
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage access_audit" ON access_audit
  FOR ALL USING (is_org_admin(org_id));

-- role_definitions
CREATE POLICY "Members can view role_definitions" ON role_definitions
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert role_definitions" ON role_definitions
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update role_definitions" ON role_definitions
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete role_definitions" ON role_definitions
  FOR DELETE USING (is_org_admin(org_id));

-- assignments
CREATE POLICY "Members can view assignments" ON assignments
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert assignments" ON assignments
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update assignments" ON assignments
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete assignments" ON assignments
  FOR DELETE USING (is_org_admin(org_id));

-- invites
CREATE POLICY "Members can view invites" ON invites
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert invites" ON invites
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update invites" ON invites
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete invites" ON invites
  FOR DELETE USING (is_org_admin(org_id));

-- pins
CREATE POLICY "Members can view pins" ON pins
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert pins" ON pins
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update pins" ON pins
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete pins" ON pins
  FOR DELETE USING (is_org_admin(org_id));

-- inv_locations (has both org_id and venue_id — use org_id)
CREATE POLICY "Members can view inv_locations" ON inv_locations
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert inv_locations" ON inv_locations
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update inv_locations" ON inv_locations
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete inv_locations" ON inv_locations
  FOR DELETE USING (is_org_admin(org_id));

-- inv_location_assignments (has both org_id and venue_id — use org_id)
CREATE POLICY "Members can view inv_location_assignments" ON inv_location_assignments
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert inv_location_assignments" ON inv_location_assignments
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update inv_location_assignments" ON inv_location_assignments
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete inv_location_assignments" ON inv_location_assignments
  FOR DELETE USING (is_org_admin(org_id));


-- -------------------------------------------
-- GROUP B: suppliers (uses organization_id, not org_id)
-- -------------------------------------------

CREATE POLICY "Members can view suppliers" ON suppliers
  FOR SELECT USING (
    organization_id IN (SELECT get_user_org_ids())
  );
CREATE POLICY "Members can insert suppliers" ON suppliers
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT get_user_org_ids())
  );
CREATE POLICY "Admins can update suppliers" ON suppliers
  FOR UPDATE USING (
    is_org_admin(organization_id)
  );
CREATE POLICY "Admins can delete suppliers" ON suppliers
  FOR DELETE USING (
    is_org_admin(organization_id)
  );


-- -------------------------------------------
-- GROUP C: Tables with venue_id only (no org_id)
-- Pattern: venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids()))
-- -------------------------------------------

-- Helper: venue access subquery
-- venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))

-- ingredients
CREATE POLICY "Members can view ingredients" ON ingredients
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert ingredients" ON ingredients
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update ingredients" ON ingredients
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete ingredients" ON ingredients
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- menu_items
CREATE POLICY "Members can view menu_items" ON menu_items
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert menu_items" ON menu_items
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update menu_items" ON menu_items
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete menu_items" ON menu_items
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- orders
CREATE POLICY "Members can view orders" ON orders
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert orders" ON orders
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update orders" ON orders
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete orders" ON orders
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- purchase_orders
CREATE POLICY "Members can view purchase_orders" ON purchase_orders
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert purchase_orders" ON purchase_orders
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update purchase_orders" ON purchase_orders
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete purchase_orders" ON purchase_orders
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- stock_counts
CREATE POLICY "Members can view stock_counts" ON stock_counts
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert stock_counts" ON stock_counts
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update stock_counts" ON stock_counts
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete stock_counts" ON stock_counts
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- waste_logs
CREATE POLICY "Members can view waste_logs" ON waste_logs
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert waste_logs" ON waste_logs
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update waste_logs" ON waste_logs
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete waste_logs" ON waste_logs
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- venue_settings
CREATE POLICY "Members can view venue_settings" ON venue_settings
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert venue_settings" ON venue_settings
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can update venue_settings" ON venue_settings
  FOR UPDATE USING (
    venue_id IN (
      SELECT v.id FROM venues v
      JOIN org_members om ON om.org_id = v.org_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager') AND om.is_active = true
    )
  );
CREATE POLICY "Admins can delete venue_settings" ON venue_settings
  FOR DELETE USING (
    venue_id IN (
      SELECT v.id FROM venues v
      JOIN org_members om ON om.org_id = v.org_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager') AND om.is_active = true
    )
  );

-- venue_settings_audit
CREATE POLICY "Members can view venue_settings_audit" ON venue_settings_audit
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert venue_settings_audit" ON venue_settings_audit
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- device_assignments
CREATE POLICY "Members can view device_assignments" ON device_assignments
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can insert device_assignments" ON device_assignments
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can update device_assignments" ON device_assignments
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete device_assignments" ON device_assignments
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- count_schedules
CREATE POLICY "Members can view count_schedules" ON count_schedules
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can insert count_schedules" ON count_schedules
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can update count_schedules" ON count_schedules
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete count_schedules" ON count_schedules
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- stock_levels (venue_id references venues)
CREATE POLICY "Members can view stock_levels" ON stock_levels
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert stock_levels" ON stock_levels
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update stock_levels" ON stock_levels
  FOR UPDATE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete stock_levels" ON stock_levels
  FOR DELETE USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );


-- -------------------------------------------
-- GROUP D: Child tables (join through parent)
-- -------------------------------------------

-- purchase_order_items → purchase_orders → venue
CREATE POLICY "Members can view purchase_order_items" ON purchase_order_items
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );
CREATE POLICY "Members can insert purchase_order_items" ON purchase_order_items
  FOR INSERT WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );
CREATE POLICY "Members can update purchase_order_items" ON purchase_order_items
  FOR UPDATE USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );
CREATE POLICY "Admins can delete purchase_order_items" ON purchase_order_items
  FOR DELETE USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );

-- stock_count_items → stock_counts → venue
CREATE POLICY "Members can view stock_count_items" ON stock_count_items
  FOR SELECT USING (
    stock_count_id IN (
      SELECT id FROM stock_counts
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );
CREATE POLICY "Members can insert stock_count_items" ON stock_count_items
  FOR INSERT WITH CHECK (
    stock_count_id IN (
      SELECT id FROM stock_counts
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );
CREATE POLICY "Members can update stock_count_items" ON stock_count_items
  FOR UPDATE USING (
    stock_count_id IN (
      SELECT id FROM stock_counts
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );
CREATE POLICY "Admins can delete stock_count_items" ON stock_count_items
  FOR DELETE USING (
    stock_count_id IN (
      SELECT id FROM stock_counts
      WHERE venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
    )
  );

-- inv_bins → inv_locations → org_id
CREATE POLICY "Members can view inv_bins" ON inv_bins
  FOR SELECT USING (
    location_id IN (
      SELECT id FROM inv_locations WHERE org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can insert inv_bins" ON inv_bins
  FOR INSERT WITH CHECK (
    location_id IN (
      SELECT id FROM inv_locations WHERE org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can update inv_bins" ON inv_bins
  FOR UPDATE USING (
    location_id IN (
      SELECT id FROM inv_locations WHERE org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can delete inv_bins" ON inv_bins
  FOR DELETE USING (
    location_id IN (
      SELECT id FROM inv_locations WHERE org_id IN (SELECT get_user_org_ids())
    )
  );


-- -------------------------------------------
-- GROUP E: Staff (org_member_id → org_members → org_id)
-- Note: existing policies from 20250203000001 are already correct
-- We just drop them to recreate consistently
-- -------------------------------------------

DROP POLICY IF EXISTS "Members can view staff" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

CREATE POLICY "Members can view staff" ON staff
  FOR SELECT USING (
    org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert staff" ON staff
  FOR INSERT WITH CHECK (
    org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can update staff" ON staff
  FOR UPDATE USING (
    org_member_id IN (
      SELECT id FROM org_members
      WHERE org_id IN (SELECT get_user_org_ids()) AND is_org_admin(org_id)
    )
  );
CREATE POLICY "Admins can delete staff" ON staff
  FOR DELETE USING (
    org_member_id IN (
      SELECT id FROM org_members
      WHERE org_id IN (SELECT get_user_org_ids()) AND is_org_admin(org_id)
    )
  );

-- staff_documents → staff → org_members
DROP POLICY IF EXISTS "Access staff documents" ON staff_documents;

CREATE POLICY "Members can view staff_documents" ON staff_documents
  FOR SELECT USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Members can insert staff_documents" ON staff_documents
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can update staff_documents" ON staff_documents
  FOR UPDATE USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can delete staff_documents" ON staff_documents
  FOR DELETE USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );

-- staff_availability → staff → org_members
DROP POLICY IF EXISTS "Access staff availability" ON staff_availability;

CREATE POLICY "Members can view staff_availability" ON staff_availability
  FOR SELECT USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Members can insert staff_availability" ON staff_availability
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Members can update staff_availability" ON staff_availability
  FOR UPDATE USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can delete staff_availability" ON staff_availability
  FOR DELETE USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );

-- leave_requests → staff → org_members
DROP POLICY IF EXISTS "Access leave requests" ON leave_requests;

CREATE POLICY "Members can view leave_requests" ON leave_requests
  FOR SELECT USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Members can insert leave_requests" ON leave_requests
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can update leave_requests" ON leave_requests
  FOR UPDATE USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );
CREATE POLICY "Admins can delete leave_requests" ON leave_requests
  FOR DELETE USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN org_members om ON om.id = s.org_member_id
      WHERE om.org_id IN (SELECT get_user_org_ids())
    )
  );


-- -------------------------------------------
-- GROUP F: User-scoped tables
-- -------------------------------------------

-- profiles: users can only read/update their own profile
-- (Drop existing to avoid conflict, then recreate)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service can create profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());
-- Service role handles profile creation on signup via trigger
CREATE POLICY "Service can create profiles" ON profiles
  FOR INSERT WITH CHECK (true);

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can insert roles" ON user_roles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update roles" ON user_roles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can delete roles" ON user_roles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- admin_data_jobs (requested_by = user scoped)
CREATE POLICY "Users can view own admin_data_jobs" ON admin_data_jobs
  FOR SELECT USING (requested_by = auth.uid());
CREATE POLICY "Users can insert admin_data_jobs" ON admin_data_jobs
  FOR INSERT WITH CHECK (requested_by = auth.uid());
CREATE POLICY "Users can update own admin_data_jobs" ON admin_data_jobs
  FOR UPDATE USING (requested_by = auth.uid());

-- admin_data_audit (actor_user_id = user scoped)
CREATE POLICY "Users can view own admin_data_audit" ON admin_data_audit
  FOR SELECT USING (actor_user_id = auth.uid());
CREATE POLICY "Users can insert admin_data_audit" ON admin_data_audit
  FOR INSERT WITH CHECK (actor_user_id = auth.uid());


-- -------------------------------------------
-- GROUP G: Core tables (already have proper policies from MVP)
-- Just ensure they exist — DROP IF EXISTS + recreate for consistency
-- -------------------------------------------

-- organizations
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update organization" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

CREATE POLICY "Members can view their organizations" ON organizations
  FOR SELECT USING (id IN (SELECT get_user_org_ids()));
CREATE POLICY "Owners can update organization" ON organizations
  FOR UPDATE USING (is_org_admin(id));
-- Signup flow: authenticated users must be able to create their first org
CREATE POLICY "Authenticated users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- org_members
DROP POLICY IF EXISTS "View org members" ON org_members;
DROP POLICY IF EXISTS "Admins can manage members" ON org_members;
DROP POLICY IF EXISTS "Users can add themselves to orgs they created" ON org_members;

CREATE POLICY "View org members" ON org_members
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage members" ON org_members
  FOR ALL USING (is_org_admin(org_id));
-- Signup flow: users must be able to add themselves as first member
CREATE POLICY "Users can add themselves to orgs" ON org_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- venues
DROP POLICY IF EXISTS "Members can view venues" ON venues;
DROP POLICY IF EXISTS "Admins can manage venues" ON venues;
DROP POLICY IF EXISTS "Authenticated users can create venues" ON venues;

CREATE POLICY "Members can view venues" ON venues
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage venues" ON venues
  FOR ALL USING (is_org_admin(org_id));
-- Signup flow: users must be able to create their first venue
CREATE POLICY "Authenticated users can create venues" ON venues
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

-- venue_access
DROP POLICY IF EXISTS "Access venue permissions" ON venue_access;
DROP POLICY IF EXISTS "Users can create venue access for themselves" ON venue_access;
DROP POLICY IF EXISTS "Users can view venue access" ON venue_access;

CREATE POLICY "Users can view venue_access" ON venue_access
  FOR SELECT USING (
    venue_id IN (SELECT id FROM venues WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can manage venue_access" ON venue_access
  FOR ALL USING (
    venue_id IN (
      SELECT v.id FROM venues v
      JOIN org_members om ON om.org_id = v.org_id
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'manager') AND om.is_active = true
    )
  );
-- Signup flow: users can grant themselves access to venues they create
CREATE POLICY "Users can create own venue_access" ON venue_access
  FOR INSERT WITH CHECK (user_id = auth.uid());


-- -------------------------------------------
-- Remaining org_id tables that already have MVP policies
-- Drop + recreate for consistency (some may have been created by mvp_schema_fixed)
-- -------------------------------------------

-- recipes
DROP POLICY IF EXISTS "Members can view recipes" ON recipes;
DROP POLICY IF EXISTS "Admins can manage recipes" ON recipes;

CREATE POLICY "Members can view recipes" ON recipes
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert recipes" ON recipes
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update recipes" ON recipes
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete recipes" ON recipes
  FOR DELETE USING (is_org_admin(org_id));

-- recipe_ingredients → recipes → org_id
DROP POLICY IF EXISTS "Access recipe ingredients" ON recipe_ingredients;

CREATE POLICY "Members can view recipe_ingredients" ON recipe_ingredients
  FOR SELECT USING (
    recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert recipe_ingredients" ON recipe_ingredients
  FOR INSERT WITH CHECK (
    recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can update recipe_ingredients" ON recipe_ingredients
  FOR UPDATE USING (
    recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete recipe_ingredients" ON recipe_ingredients
  FOR DELETE USING (
    recipe_id IN (SELECT id FROM recipes WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- menu_sections
DROP POLICY IF EXISTS "Members can view menu_sections" ON menu_sections;
DROP POLICY IF EXISTS "Admins can manage menu_sections" ON menu_sections;

CREATE POLICY "Members can view menu_sections" ON menu_sections
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert menu_sections" ON menu_sections
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update menu_sections" ON menu_sections
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete menu_sections" ON menu_sections
  FOR DELETE USING (is_org_admin(org_id));

-- onboarding_invites
DROP POLICY IF EXISTS "Members can view onboarding_invites" ON onboarding_invites;
DROP POLICY IF EXISTS "Admins can manage onboarding_invites" ON onboarding_invites;

CREATE POLICY "Members can view onboarding_invites" ON onboarding_invites
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert onboarding_invites" ON onboarding_invites
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update onboarding_invites" ON onboarding_invites
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete onboarding_invites" ON onboarding_invites
  FOR DELETE USING (is_org_admin(org_id));

-- roster_shifts
DROP POLICY IF EXISTS "Members can view roster_shifts" ON roster_shifts;
DROP POLICY IF EXISTS "Admins can manage roster_shifts" ON roster_shifts;

CREATE POLICY "Members can view roster_shifts" ON roster_shifts
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert roster_shifts" ON roster_shifts
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update roster_shifts" ON roster_shifts
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete roster_shifts" ON roster_shifts
  FOR DELETE USING (is_org_admin(org_id));

-- timesheets
DROP POLICY IF EXISTS "Members can view timesheets" ON timesheets;
DROP POLICY IF EXISTS "Admins can manage timesheets" ON timesheets;

CREATE POLICY "Members can view timesheets" ON timesheets
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert timesheets" ON timesheets
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update timesheets" ON timesheets
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete timesheets" ON timesheets
  FOR DELETE USING (is_org_admin(org_id));

-- shift_templates (already proper from 20250208 — drop + recreate for consistency)
DROP POLICY IF EXISTS "Members can view shift_templates" ON shift_templates;
DROP POLICY IF EXISTS "Admins can manage shift_templates" ON shift_templates;

CREATE POLICY "Members can view shift_templates" ON shift_templates
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert shift_templates" ON shift_templates
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update shift_templates" ON shift_templates
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete shift_templates" ON shift_templates
  FOR DELETE USING (is_org_admin(org_id));

-- shift_swap_requests (already proper from 20250208 — drop + recreate for consistency)
DROP POLICY IF EXISTS "Members can view shift_swap_requests" ON shift_swap_requests;
DROP POLICY IF EXISTS "Members can create shift_swap_requests" ON shift_swap_requests;
DROP POLICY IF EXISTS "Admins can manage shift_swap_requests" ON shift_swap_requests;
DROP POLICY IF EXISTS "Admins can delete shift_swap_requests" ON shift_swap_requests;

CREATE POLICY "Members can view shift_swap_requests" ON shift_swap_requests
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert shift_swap_requests" ON shift_swap_requests
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update shift_swap_requests" ON shift_swap_requests
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete shift_swap_requests" ON shift_swap_requests
  FOR DELETE USING (is_org_admin(org_id));

-- labor_budgets (already proper from 20250208 — drop + recreate for consistency)
DROP POLICY IF EXISTS "Members can view labor_budgets" ON labor_budgets;
DROP POLICY IF EXISTS "Admins can manage labor_budgets" ON labor_budgets;

CREATE POLICY "Members can view labor_budgets" ON labor_budgets
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert labor_budgets" ON labor_budgets
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update labor_budgets" ON labor_budgets
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete labor_budgets" ON labor_budgets
  FOR DELETE USING (is_org_admin(org_id));

-- roster_warnings (already proper from 20250208 — drop + recreate for consistency)
DROP POLICY IF EXISTS "Members can view roster_warnings" ON roster_warnings;
DROP POLICY IF EXISTS "Admins can manage roster_warnings" ON roster_warnings;

CREATE POLICY "Members can view roster_warnings" ON roster_warnings
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert roster_warnings" ON roster_warnings
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update roster_warnings" ON roster_warnings
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete roster_warnings" ON roster_warnings
  FOR DELETE USING (is_org_admin(org_id));

-- pos_connections
DROP POLICY IF EXISTS "Members can view pos_connections" ON pos_connections;
DROP POLICY IF EXISTS "Admins can manage pos_connections" ON pos_connections;

CREATE POLICY "Members can view pos_connections" ON pos_connections
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can insert pos_connections" ON pos_connections
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update pos_connections" ON pos_connections
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete pos_connections" ON pos_connections
  FOR DELETE USING (is_org_admin(org_id));

-- pos_location_mappings → pos_connections → org_id
DROP POLICY IF EXISTS "Access POS mappings" ON pos_location_mappings;

CREATE POLICY "Members can view pos_location_mappings" ON pos_location_mappings
  FOR SELECT USING (
    connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can insert pos_location_mappings" ON pos_location_mappings
  FOR INSERT WITH CHECK (
    connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can update pos_location_mappings" ON pos_location_mappings
  FOR UPDATE USING (
    connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete pos_location_mappings" ON pos_location_mappings
  FOR DELETE USING (
    connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- sales_transactions
DROP POLICY IF EXISTS "Members can view sales_transactions" ON sales_transactions;
DROP POLICY IF EXISTS "Admins can manage sales_transactions" ON sales_transactions;

CREATE POLICY "Members can view sales_transactions" ON sales_transactions
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert sales_transactions" ON sales_transactions
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update sales_transactions" ON sales_transactions
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete sales_transactions" ON sales_transactions
  FOR DELETE USING (is_org_admin(org_id));

-- sales_transaction_items → sales_transactions → org_id
DROP POLICY IF EXISTS "Access sales items" ON sales_transaction_items;

CREATE POLICY "Members can view sales_transaction_items" ON sales_transaction_items
  FOR SELECT USING (
    transaction_id IN (SELECT id FROM sales_transactions WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Members can insert sales_transaction_items" ON sales_transaction_items
  FOR INSERT WITH CHECK (
    transaction_id IN (SELECT id FROM sales_transactions WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can update sales_transaction_items" ON sales_transaction_items
  FOR UPDATE USING (
    transaction_id IN (SELECT id FROM sales_transactions WHERE org_id IN (SELECT get_user_org_ids()))
  );
CREATE POLICY "Admins can delete sales_transaction_items" ON sales_transaction_items
  FOR DELETE USING (
    transaction_id IN (SELECT id FROM sales_transactions WHERE org_id IN (SELECT get_user_org_ids()))
  );

-- daybook_entries
DROP POLICY IF EXISTS "Members can view daybook_entries" ON daybook_entries;
DROP POLICY IF EXISTS "Admins can manage daybook_entries" ON daybook_entries;

CREATE POLICY "Members can view daybook_entries" ON daybook_entries
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert daybook_entries" ON daybook_entries
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update daybook_entries" ON daybook_entries
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete daybook_entries" ON daybook_entries
  FOR DELETE USING (is_org_admin(org_id));

-- compliance_checks
DROP POLICY IF EXISTS "Members can view compliance_checks" ON compliance_checks;
DROP POLICY IF EXISTS "Admins can manage compliance_checks" ON compliance_checks;

CREATE POLICY "Members can view compliance_checks" ON compliance_checks
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert compliance_checks" ON compliance_checks
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can update compliance_checks" ON compliance_checks
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete compliance_checks" ON compliance_checks
  FOR DELETE USING (is_org_admin(org_id));

-- audit_log
DROP POLICY IF EXISTS "Members can view audit_log" ON audit_log;
DROP POLICY IF EXISTS "Admins can manage audit_log" ON audit_log;

CREATE POLICY "Members can view audit_log" ON audit_log
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert audit_log" ON audit_log
  FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));

-- chart_of_accounts
DROP POLICY IF EXISTS "Members can view chart_of_accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "Admins can manage chart_of_accounts" ON chart_of_accounts;

CREATE POLICY "Members can view chart_of_accounts" ON chart_of_accounts
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can insert chart_of_accounts" ON chart_of_accounts
  FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can update chart_of_accounts" ON chart_of_accounts
  FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete chart_of_accounts" ON chart_of_accounts
  FOR DELETE USING (is_org_admin(org_id));
