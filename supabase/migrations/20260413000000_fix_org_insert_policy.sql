-- Fix organization insert policy to not rely on created_by column
-- which doesn't exist in the organizations table

-- Drop the problematic policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

-- Create a simpler policy that allows authenticated users to create organizations
CREATE POLICY "Authenticated users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix the venues insert policy to not check created_by
DROP POLICY IF EXISTS "Authenticated users can create venues" ON venues;

CREATE POLICY "Authenticated users can create venues"
ON venues FOR INSERT
TO authenticated
WITH CHECK (
  -- Check if user is an admin of the org
  is_org_admin(org_id)
  -- Or they're creating the first venue during signup (no org_members yet)
  OR NOT EXISTS (
    SELECT 1 FROM org_members WHERE org_id = venues.org_id
  )
);

-- Fix org_members insert policy
DROP POLICY IF EXISTS "Users can add themselves to orgs they created" ON org_members;

CREATE POLICY "Users can join organizations"
ON org_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- They're the first member (owner during signup)
    NOT EXISTS (SELECT 1 FROM org_members WHERE org_id = org_members.org_id)
    -- Or they're being added by an admin
    OR is_org_admin(org_id)
  )
);