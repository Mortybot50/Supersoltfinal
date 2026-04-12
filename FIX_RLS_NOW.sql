-- RUN THIS SQL IN SUPABASE SQL EDITOR TO FIX THE SETUP WIZARD
-- https://supabase.com/dashboard/project/vcfmouckydhsmvfoykms/sql/new

-- Drop ALL existing policies on organizations table
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'organizations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON organizations', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Create a single permissive policy for authenticated users
CREATE POLICY "authenticated_all_access"
ON organizations 
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify the fix worked
SELECT 
    'SUCCESS!' as status,
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'organizations';