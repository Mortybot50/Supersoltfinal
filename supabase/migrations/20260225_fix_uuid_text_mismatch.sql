-- ============================================
-- Migration: Fix UUID vs TEXT mismatch on org_id/venue_id columns
-- Date: 2026-02-25
-- Purpose: Convert all TEXT org_id/venue_id columns to UUID, add FK constraints,
--          drop USING(true) RLS policies, add proper org-scoped RLS
-- ============================================

-- Helper: get user org ids (already exists, but ensure it's current)
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get venue ids for user's orgs
CREATE OR REPLACE FUNCTION get_user_venue_ids()
RETURNS SETOF UUID AS $$
  SELECT v.id FROM venues v
  WHERE v.org_id IN (SELECT get_user_org_ids());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 1. Clean up stale seed data
-- ============================================
DELETE FROM role_definitions WHERE org_id = 'default';

-- ============================================
-- 2. Drop all USING(true) policies
-- ============================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'Allow all operations on %'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ============================================
-- 3. Drop existing indexes that reference columns we're altering
-- ============================================
DROP INDEX IF EXISTS idx_access_audit_org;
DROP INDEX IF EXISTS idx_assignments_org;
DROP INDEX IF EXISTS idx_assignments_member;
DROP INDEX IF EXISTS idx_count_schedules_venue;
DROP INDEX IF EXISTS idx_device_assignments_venue;
DROP INDEX IF EXISTS idx_ingredients_venue;
DROP INDEX IF EXISTS idx_inv_locations_active;
DROP INDEX IF EXISTS idx_inv_locations_code;
DROP INDEX IF EXISTS idx_inv_locations_type;
DROP INDEX IF EXISTS idx_inv_locations_venue;
DROP INDEX IF EXISTS idx_invites_org;
DROP INDEX IF EXISTS idx_members_org_email;
DROP INDEX IF EXISTS idx_members_status;
DROP INDEX IF EXISTS idx_menu_items_venue;
DROP INDEX IF EXISTS idx_orders_venue_id;
DROP INDEX IF EXISTS idx_pins_org;
DROP INDEX IF EXISTS idx_purchase_orders_venue;
DROP INDEX IF EXISTS idx_role_definitions_org;
DROP INDEX IF EXISTS idx_stock_counts_venue;
DROP INDEX IF EXISTS idx_waste_logs_venue;

-- Drop unique constraints that reference columns we're altering
ALTER TABLE inv_locations DROP CONSTRAINT IF EXISTS inv_locations_venue_code_unique;
ALTER TABLE inv_locations DROP CONSTRAINT IF EXISTS inv_locations_venue_name_unique;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_org_id_primary_email_key;
ALTER TABLE role_definitions DROP CONSTRAINT IF EXISTS role_definitions_org_id_key_key;
ALTER TABLE venue_settings DROP CONSTRAINT IF EXISTS venue_settings_venue_id_key;
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_member_id_role_id_venue_id_key;

-- ============================================
-- 4. ALTER columns from TEXT to UUID
-- ============================================

-- Tables with org_id TEXT -> UUID
ALTER TABLE access_audit ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
ALTER TABLE assignments ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
ALTER TABLE inv_location_assignments ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
ALTER TABLE inv_locations ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
ALTER TABLE invites ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
ALTER TABLE members ALTER COLUMN org_id TYPE uuid USING org_id::uuid;
ALTER TABLE pins ALTER COLUMN org_id TYPE uuid USING org_id::uuid;

-- suppliers uses organization_id (not org_id) — keep name, fix type
ALTER TABLE suppliers ALTER COLUMN organization_id TYPE uuid USING organization_id::uuid;
ALTER TABLE role_definitions ALTER COLUMN org_id TYPE uuid USING org_id::uuid;

-- Tables with venue_id TEXT -> UUID
ALTER TABLE assignments ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE count_schedules ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE device_assignments ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE ingredients ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE inv_location_assignments ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE inv_locations ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE invites ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE menu_items ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE orders ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE purchase_orders ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE stock_counts ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE venue_settings ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE venue_settings_audit ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;
ALTER TABLE waste_logs ALTER COLUMN venue_id TYPE uuid USING venue_id::uuid;

-- ============================================
-- 5. Add org_id column to venue-only tables (for RLS)
-- ============================================
ALTER TABLE count_schedules ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE device_assignments ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE stock_counts ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE venue_settings ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE venue_settings_audit ADD COLUMN IF NOT EXISTS org_id uuid;
ALTER TABLE waste_logs ADD COLUMN IF NOT EXISTS org_id uuid;

-- Backfill org_id from venues table for any existing rows
UPDATE count_schedules SET org_id = v.org_id FROM venues v WHERE count_schedules.venue_id = v.id AND count_schedules.org_id IS NULL;
UPDATE device_assignments SET org_id = v.org_id FROM venues v WHERE device_assignments.venue_id = v.id AND device_assignments.org_id IS NULL;
UPDATE ingredients SET org_id = v.org_id FROM venues v WHERE ingredients.venue_id = v.id AND ingredients.org_id IS NULL;
UPDATE menu_items SET org_id = v.org_id FROM venues v WHERE menu_items.venue_id = v.id AND menu_items.org_id IS NULL;
UPDATE orders SET org_id = v.org_id FROM venues v WHERE orders.venue_id = v.id AND orders.org_id IS NULL;
UPDATE purchase_orders SET org_id = v.org_id FROM venues v WHERE purchase_orders.venue_id = v.id AND purchase_orders.org_id IS NULL;
UPDATE stock_counts SET org_id = v.org_id FROM venues v WHERE stock_counts.venue_id = v.id AND stock_counts.org_id IS NULL;
UPDATE venue_settings SET org_id = v.org_id FROM venues v WHERE venue_settings.venue_id = v.id AND venue_settings.org_id IS NULL;
UPDATE venue_settings_audit SET org_id = v.org_id FROM venues v WHERE venue_settings_audit.venue_id = v.id AND venue_settings_audit.org_id IS NULL;
UPDATE waste_logs SET org_id = v.org_id FROM venues v WHERE waste_logs.venue_id = v.id AND waste_logs.org_id IS NULL;

-- ============================================
-- 6. Add FK constraints
-- ============================================
ALTER TABLE access_audit ADD CONSTRAINT access_audit_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD CONSTRAINT assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE assignments ADD CONSTRAINT assignments_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE count_schedules ADD CONSTRAINT count_schedules_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE count_schedules ADD CONSTRAINT count_schedules_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE device_assignments ADD CONSTRAINT device_assignments_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE device_assignments ADD CONSTRAINT device_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE ingredients ADD CONSTRAINT ingredients_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE ingredients ADD CONSTRAINT ingredients_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE inv_location_assignments ADD CONSTRAINT inv_location_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE inv_location_assignments ADD CONSTRAINT inv_location_assignments_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE inv_locations ADD CONSTRAINT inv_locations_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE inv_locations ADD CONSTRAINT inv_locations_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE invites ADD CONSTRAINT invites_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE invites ADD CONSTRAINT invites_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE members ADD CONSTRAINT members_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE orders ADD CONSTRAINT orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE pins ADD CONSTRAINT pins_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_org_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE role_definitions ADD CONSTRAINT role_definitions_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE stock_counts ADD CONSTRAINT stock_counts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE venue_settings ADD CONSTRAINT venue_settings_venue_id_fkey2 FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE venue_settings ADD CONSTRAINT venue_settings_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE venue_settings_audit ADD CONSTRAINT venue_settings_audit_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE venue_settings_audit ADD CONSTRAINT venue_settings_audit_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE waste_logs ADD CONSTRAINT waste_logs_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE;
ALTER TABLE waste_logs ADD CONSTRAINT waste_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- 7. Re-create indexes
-- ============================================
CREATE INDEX idx_access_audit_org ON access_audit(org_id, created_at DESC);
CREATE INDEX idx_assignments_org ON assignments(org_id);
CREATE INDEX idx_assignments_member ON assignments(member_id, venue_id, role_id);
CREATE INDEX idx_count_schedules_venue ON count_schedules(venue_id);
CREATE INDEX idx_count_schedules_org ON count_schedules(org_id);
CREATE INDEX idx_device_assignments_venue ON device_assignments(venue_id);
CREATE INDEX idx_device_assignments_org ON device_assignments(org_id);
CREATE INDEX idx_ingredients_venue ON ingredients(venue_id);
CREATE INDEX idx_ingredients_org ON ingredients(org_id);
CREATE INDEX idx_inv_locations_active ON inv_locations(venue_id, is_active);
CREATE INDEX idx_inv_locations_code ON inv_locations(venue_id, code);
CREATE INDEX idx_inv_locations_type ON inv_locations(venue_id, type);
CREATE INDEX idx_inv_locations_venue ON inv_locations(venue_id, name);
CREATE INDEX idx_invites_org ON invites(org_id, status);
CREATE INDEX idx_members_org_email ON members(org_id, primary_email);
CREATE INDEX idx_members_status ON members(org_id, status);
CREATE INDEX idx_menu_items_venue ON menu_items(venue_id);
CREATE INDEX idx_menu_items_org ON menu_items(org_id);
CREATE INDEX idx_orders_venue_id ON orders(venue_id);
CREATE INDEX idx_orders_org ON orders(org_id);
CREATE INDEX idx_pins_org ON pins(org_id);
CREATE INDEX idx_purchase_orders_venue ON purchase_orders(venue_id);
CREATE INDEX idx_purchase_orders_org ON purchase_orders(org_id);
CREATE INDEX idx_suppliers_org ON suppliers(organization_id);
CREATE INDEX idx_role_definitions_org ON role_definitions(org_id);
CREATE INDEX idx_stock_counts_venue ON stock_counts(venue_id);
CREATE INDEX idx_stock_counts_org ON stock_counts(org_id);
CREATE INDEX idx_waste_logs_venue ON waste_logs(venue_id);
CREATE INDEX idx_waste_logs_org ON waste_logs(org_id);

-- Re-create unique constraints
ALTER TABLE inv_locations ADD CONSTRAINT inv_locations_venue_code_unique UNIQUE (venue_id, code);
ALTER TABLE inv_locations ADD CONSTRAINT inv_locations_venue_name_unique UNIQUE (venue_id, name);
ALTER TABLE members ADD CONSTRAINT members_org_id_primary_email_key UNIQUE (org_id, primary_email);
ALTER TABLE role_definitions ADD CONSTRAINT role_definitions_org_id_key_key UNIQUE (org_id, key);
ALTER TABLE venue_settings ADD CONSTRAINT venue_settings_venue_id_key UNIQUE (venue_id);
ALTER TABLE assignments ADD CONSTRAINT assignments_member_id_role_id_venue_id_key UNIQUE (member_id, role_id, venue_id);

-- ============================================
-- 8. Create proper org-scoped RLS policies
-- ============================================

ALTER TABLE access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_settings_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;

-- Org-scoped tables: SELECT for members, ALL for members (write gated by app logic)
CREATE POLICY "Members can view" ON access_audit FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON access_audit FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON assignments FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON assignments FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON count_schedules FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON count_schedules FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON device_assignments FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON device_assignments FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON ingredients FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON ingredients FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON inv_location_assignments FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON inv_location_assignments FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON inv_locations FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON inv_locations FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON invites FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON invites FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON members FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON members FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON menu_items FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON menu_items FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON orders FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON orders FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON pins FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON pins FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON purchase_orders FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON purchase_orders FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON role_definitions FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON role_definitions FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON stock_counts FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON stock_counts FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON venue_settings FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON venue_settings FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON venue_settings_audit FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON venue_settings_audit FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Members can view" ON waste_logs FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON waste_logs FOR ALL USING (org_id IN (SELECT get_user_org_ids()));

-- Child tables (no org_id, join to parent)
CREATE POLICY "Members can view" ON purchase_order_items FOR SELECT
  USING (purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "Members can manage" ON purchase_order_items FOR ALL
  USING (purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id IN (SELECT get_user_org_ids())));

CREATE POLICY "Members can view" ON stock_count_items FOR SELECT
  USING (stock_count_id IN (SELECT id FROM stock_counts WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "Members can manage" ON stock_count_items FOR ALL
  USING (stock_count_id IN (SELECT id FROM stock_counts WHERE org_id IN (SELECT get_user_org_ids())));

CREATE POLICY "Members can view" ON inv_bins FOR SELECT
  USING (location_id IN (SELECT id FROM inv_locations WHERE org_id IN (SELECT get_user_org_ids())));
CREATE POLICY "Members can manage" ON inv_bins FOR ALL
  USING (location_id IN (SELECT id FROM inv_locations WHERE org_id IN (SELECT get_user_org_ids())));

-- Admin-level tables (no org_id, no venue_id)
CREATE POLICY "Authenticated access" ON admin_data_audit FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated access" ON admin_data_jobs FOR ALL TO authenticated USING (true);

-- Suppliers (uses organization_id instead of org_id)
CREATE POLICY "Members can view" ON suppliers FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can manage" ON suppliers FOR ALL USING (organization_id IN (SELECT get_user_org_ids()));

-- ============================================
-- 9. Re-seed role_definitions with real org UUID
-- ============================================
INSERT INTO role_definitions (org_id, key, is_system)
SELECT '7062ac24-a551-458c-8c94-9d2c396024f9', key, true
FROM (VALUES ('Owner'), ('Manager'), ('Supervisor'), ('Crew')) AS v(key)
ON CONFLICT (org_id, key) DO NOTHING;

-- ============================================
-- 10. Notify PostgREST to reload schema cache
-- ============================================
NOTIFY pgrst, 'reload schema';
