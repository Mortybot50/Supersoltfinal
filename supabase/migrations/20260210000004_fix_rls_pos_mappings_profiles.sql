-- ============================================
-- FIX 1 (HIGH): pos_location_mappings RLS policies reference wrong column
--
-- The 20260210000000 migration created policies using "connection_id"
-- but the actual column is "pos_connection_id". All 4 policies were no-ops.
-- ============================================

-- Drop the broken policies (using their original names)
DROP POLICY IF EXISTS "Members can view pos_location_mappings" ON pos_location_mappings;
DROP POLICY IF EXISTS "Admins can insert pos_location_mappings" ON pos_location_mappings;
DROP POLICY IF EXISTS "Admins can update pos_location_mappings" ON pos_location_mappings;
DROP POLICY IF EXISTS "Admins can delete pos_location_mappings" ON pos_location_mappings;

-- Recreate with correct column name: pos_connection_id
CREATE POLICY "Members can view pos_location_mappings" ON pos_location_mappings
  FOR SELECT USING (
    pos_connection_id IN (SELECT id FROM pos_connections WHERE org_id IN (SELECT get_user_org_ids()))
  );

CREATE POLICY "Admins can insert pos_location_mappings" ON pos_location_mappings
  FOR INSERT WITH CHECK (
    pos_connection_id IN (SELECT id FROM pos_connections WHERE is_org_admin(org_id))
  );

CREATE POLICY "Admins can update pos_location_mappings" ON pos_location_mappings
  FOR UPDATE USING (
    pos_connection_id IN (SELECT id FROM pos_connections WHERE is_org_admin(org_id))
  );

CREATE POLICY "Admins can delete pos_location_mappings" ON pos_location_mappings
  FOR DELETE USING (
    pos_connection_id IN (SELECT id FROM pos_connections WHERE is_org_admin(org_id))
  );


-- ============================================
-- FIX 2 (MEDIUM): profiles INSERT policy too permissive
--
-- "Service can create profiles" used WITH CHECK (true), allowing any
-- authenticated user to insert a profile row for ANY user ID.
-- The signup trigger runs as SECURITY DEFINER (bypasses RLS), so
-- restricting this to id = auth.uid() doesn't break signup.
-- ============================================

DROP POLICY IF EXISTS "Service can create profiles" ON profiles;

CREATE POLICY "Users can create own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());
