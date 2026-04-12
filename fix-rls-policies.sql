-- SuperSolt RLS Policy Fix
-- Run this in your Supabase SQL Editor

-- 1. Fix organization insert policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

CREATE POLICY "Authenticated users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Fix venues insert policy
DROP POLICY IF EXISTS "Authenticated users can create venues" ON venues;

CREATE POLICY "Authenticated users can create venues"
ON venues FOR INSERT
TO authenticated
WITH CHECK (
  -- User is admin of the org
  is_org_admin(org_id)
  -- OR it's the first venue during signup (no org_members exist yet)
  OR NOT EXISTS (
    SELECT 1 FROM org_members WHERE org_id = venues.org_id
  )
);

-- 3. Fix org_members insert policy
DROP POLICY IF EXISTS "Users can add themselves to orgs they created" ON org_members;
DROP POLICY IF EXISTS "Users can join organizations" ON org_members;

CREATE POLICY "Users can join organizations"
ON org_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- They're the first member (owner during signup)
    NOT EXISTS (SELECT 1 FROM org_members WHERE org_id = org_members.org_id)
    -- OR they're being added by an admin
    OR is_org_admin(org_id)
  )
);

-- 4. Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('organizations', 'venues', 'org_members')
AND policyname LIKE '%create%'
ORDER BY tablename, policyname;