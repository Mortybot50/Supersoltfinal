-- ============================================
-- Fix RLS: ingredient_price_history, org_members, organizations, venues write policies
-- Date: 2026-02-25
-- ============================================

-- ── ingredient_price_history: replace USING(true) with org-scoped ──
DROP POLICY IF EXISTS "iph1" ON ingredient_price_history;
DROP POLICY IF EXISTS "iph2" ON ingredient_price_history;

CREATE POLICY "iph_select" ON ingredient_price_history FOR SELECT
  USING (ingredient_id IN (
    SELECT id FROM ingredients WHERE org_id IN (SELECT get_user_org_ids())
  ));

CREATE POLICY "iph_insert" ON ingredient_price_history FOR INSERT
  WITH CHECK (ingredient_id IN (
    SELECT id FROM ingredients WHERE org_id IN (SELECT get_user_org_ids())
  ));

CREATE POLICY "iph_update" ON ingredient_price_history FOR UPDATE
  USING (ingredient_id IN (
    SELECT id FROM ingredients WHERE org_id IN (SELECT get_user_org_ids())
  ));

CREATE POLICY "iph_delete" ON ingredient_price_history FOR DELETE
  USING (ingredient_id IN (
    SELECT id FROM ingredients WHERE org_id IN (SELECT get_user_org_ids())
  ));

-- ── organizations: allow authenticated users to create (signup flow) ──
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can update their organizations" ON organizations;
CREATE POLICY "Owners can update their organizations" ON organizations
  FOR UPDATE USING (id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  ));

-- ── org_members: INSERT for self (signup), UPDATE/DELETE for org owners ──
DROP POLICY IF EXISTS "Users can add themselves to orgs" ON org_members;
CREATE POLICY "Users can add themselves to orgs" ON org_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Org owners can manage members" ON org_members;
CREATE POLICY "Org owners can manage members" ON org_members
  FOR UPDATE USING (org_id IN (
    SELECT om.org_id FROM org_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin') AND om.is_active = true
  ));

DROP POLICY IF EXISTS "Org owners can remove members" ON org_members;
CREATE POLICY "Org owners can remove members" ON org_members
  FOR DELETE USING (org_id IN (
    SELECT om.org_id FROM org_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin') AND om.is_active = true
  ));

-- Allow members to view all org members (not just self)
DROP POLICY IF EXISTS "Users can view own org memberships" ON org_members;
CREATE POLICY "Members can view org members" ON org_members
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));

-- ── venues: INSERT/UPDATE for org owners/admins ──
DROP POLICY IF EXISTS "Owners can create venues" ON venues;
CREATE POLICY "Owners can create venues" ON venues
  FOR INSERT WITH CHECK (org_id IN (
    SELECT om.org_id FROM org_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin') AND om.is_active = true
  ));

DROP POLICY IF EXISTS "Owners can update venues" ON venues;
CREATE POLICY "Owners can update venues" ON venues
  FOR UPDATE USING (org_id IN (
    SELECT om.org_id FROM org_members om
    WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin') AND om.is_active = true
  ));

-- ── admin_data tables: restrict to org admins ──
DROP POLICY IF EXISTS "Authenticated access" ON admin_data_audit;
DROP POLICY IF EXISTS "Authenticated access" ON admin_data_jobs;

CREATE POLICY "Admins only" ON admin_data_audit FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ));

CREATE POLICY "Admins only" ON admin_data_jobs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
  ));

NOTIFY pgrst, 'reload schema';
