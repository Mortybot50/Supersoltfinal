-- Comprehensive RLS fix for SuperSolt
-- Run this in Supabase SQL Editor

-- 1. First, check what policies exist
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY policyname;

-- 2. Drop ALL existing policies on organizations
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update organization" ON organizations;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

-- 3. Create new comprehensive policies
-- Allow authenticated users to create organizations
CREATE POLICY "Anyone can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to view organizations they're members of
CREATE POLICY "View own organizations"
ON organizations FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  )
);

-- Allow admins to update their organizations
CREATE POLICY "Update own organizations"
ON organizations FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT org_id FROM org_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
);

-- 4. Verify the policies were created
SELECT 
  tablename,
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY policyname;