-- Fix RLS policies for tables without direct org_id

-- First, drop the incorrectly created policies for staff table
DROP POLICY IF EXISTS "Members can view staff" ON staff;
DROP POLICY IF EXISTS "Admins can manage staff" ON staff;

-- Create correct policies for staff (uses org_member_id -> org_members -> org_id)
CREATE POLICY "Members can view staff" ON staff
  FOR SELECT USING (
    org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()))
  );

CREATE POLICY "Admins can manage staff" ON staff
  FOR ALL USING (
    org_member_id IN (SELECT id FROM org_members WHERE org_id IN (SELECT get_user_org_ids()) AND is_org_admin(org_id))
  );
