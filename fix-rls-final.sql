-- SuperSolt RLS Fix - Final Solution
-- This will completely reset RLS policies on the organizations table

-- Step 1: Show current policies (for debugging)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'organizations'
ORDER BY policyname;

-- Step 2: Drop ALL existing policies using dynamic SQL
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Loop through all policies on organizations table
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'organizations'
    LOOP
        -- Drop each policy
        EXECUTE format('DROP POLICY IF EXISTS %I ON organizations', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Step 3: Create a single, simple policy that allows everything for authenticated users
CREATE POLICY "authenticated_all_access"
ON organizations 
FOR ALL                    -- Covers SELECT, INSERT, UPDATE, DELETE
TO authenticated          -- Only for logged-in users
USING (true)             -- No restrictions on viewing
WITH CHECK (true);       -- No restrictions on modifications

-- Step 4: Verify the new policy is in place
SELECT 
  'AFTER FIX:' as status,
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'organizations';

-- Step 5: Test that authenticated users can now insert
-- This is just for verification - you can see the policy allows it
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'organizations' 
      AND policyname = 'authenticated_all_access'
      AND cmd = 'ALL'
    )
    THEN '✅ RLS policies fixed! Authenticated users can now INSERT organizations.'
    ELSE '❌ Something went wrong - please check the policies above.'
  END as result;