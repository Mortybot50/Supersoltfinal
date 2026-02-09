-- Fix RLS policies for signup flow
-- Allow authenticated users to create organizations, venues, and become members

-- Allow authenticated users to INSERT organizations (for first signup)
CREATE POLICY "Authenticated users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to INSERT venues if they can manage the org
-- For initial signup, the org was just created by them
CREATE POLICY "Authenticated users can create venues"
ON venues FOR INSERT
TO authenticated
WITH CHECK (
  -- Either they created the org (created_by matches) or they're an admin
  org_id IN (SELECT id FROM organizations WHERE created_by = auth.uid())
  OR is_org_admin(org_id)
);

-- Allow authenticated users to INSERT themselves as org members
CREATE POLICY "Users can add themselves to orgs they created"
ON org_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- They created the organization
    org_id IN (SELECT id FROM organizations WHERE created_by = auth.uid())
    -- Or they're being added by an admin (handled by existing policy)
    OR is_org_admin(org_id)
  )
);

-- Allow users to create venue access for themselves
CREATE POLICY "Users can create venue access for themselves"
ON venue_access FOR INSERT
TO authenticated
WITH CHECK (
  org_member_id IN (
    SELECT id FROM org_members
    WHERE user_id = auth.uid()
  )
);

-- View venue access
CREATE POLICY "Users can view venue access"
ON venue_access FOR SELECT
TO authenticated
USING (
  org_member_id IN (
    SELECT id FROM org_members
    WHERE user_id = auth.uid()
  )
  OR
  venue_id IN (
    SELECT v.id FROM venues v
    WHERE v.org_id IN (SELECT get_user_org_ids())
  )
);

-- Allow profile insert by trigger (should already work with SECURITY DEFINER, but let's be safe)
CREATE POLICY "Service can create profiles"
ON profiles FOR INSERT
WITH CHECK (true);
