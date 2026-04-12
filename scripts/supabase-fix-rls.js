import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vcfmouckydhsmvfoykms.supabase.co";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZm1vdWNreWRoc212Zm95a21zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxMzkyMiwiZXhwIjoyMDg3NDg5OTIyfQ.DB-uSizIuMzN96fK2DLVtiq9JWgtRKA3uP6ZO0_w0mM";

// Create a Supabase client with the service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testCreateOrganization() {
  console.log("Testing organization creation with service role...\n");

  try {
    // First, let's check existing policies
    const { data: policies, error: policiesError } = await supabase
      .rpc("get_policies", { table_name: "organizations" })
      .catch(() => ({ data: null, error: "RPC not available" }));

    if (policies) {
      console.log("Current policies:", policies);
    }

    // Try to insert an organization directly using service role
    console.log("Attempting to create organization with service role...");
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: "Test Organization Service Role",
        settings: {
          abn: "12345678901",
          gst_registered: true,
        },
      })
      .select()
      .single();

    if (orgError) {
      console.error("❌ Failed to create organization:", orgError);
    } else {
      console.log("✅ Organization created successfully:", org);

      // Clean up - delete the test org
      const { error: deleteError } = await supabase
        .from("organizations")
        .delete()
        .eq("id", org.id);

      if (deleteError) {
        console.error("Failed to delete test org:", deleteError);
      } else {
        console.log("✅ Test organization cleaned up");
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }

  console.log(
    "\nSince direct SQL execution is not available via the client library,",
  );
  console.log("please run the following SQL in your Supabase SQL Editor:\n");
  console.log(`-- Drop ALL existing policies on organizations
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update organization" ON organizations;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Anyone can create organizations" ON organizations;
DROP POLICY IF EXISTS "View own organizations" ON organizations;
DROP POLICY IF EXISTS "Update own organizations" ON organizations;

-- Create new policies (simpler approach)
-- 1. Allow all authenticated users to create organizations
CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Allow users to view organizations they belong to
CREATE POLICY "Users view their organizations"
ON organizations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members 
    WHERE org_members.org_id = organizations.id 
    AND org_members.user_id = auth.uid()
  )
  OR NOT EXISTS (
    SELECT 1 FROM org_members 
    WHERE org_members.org_id = organizations.id
  )
);

-- 3. Allow organization owners/managers to update
CREATE POLICY "Owners update organizations"
ON organizations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM org_members 
    WHERE org_members.org_id = organizations.id 
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'manager')
  )
);

-- Verify the policies
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'organizations'
ORDER BY policyname;`);
}

testCreateOrganization();
