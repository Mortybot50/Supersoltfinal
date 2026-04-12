import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vcfmouckydhsmvfoykms.supabase.co";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZm1vdWNreWRoc212Zm95a21zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkxMzkyMiwiZXhwIjoyMDg3NDg5OTIyfQ.DB-uSizIuMzN96fK2DLVtiq9JWgtRKA3uP6ZO0_w0mM";

// Create admin client with service role
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
});

// Create a normal client to test with
const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjZm1vdWNreWRoc212Zm95a21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTM5MjIsImV4cCI6MjA4NzQ4OTkyMn0.5gjI-PbG3tkXkZVOxe-enkComfceldNViFjC288SPDg";
const normalClient = createClient(supabaseUrl, anonKey);

async function fixRLSPolicies() {
  console.log("🔧 Fixing RLS policies for organizations table...\n");

  try {
    // Step 1: Test if we can insert with service role (bypasses RLS)
    console.log("1️⃣ Testing INSERT with service role (bypasses RLS)...");
    const testOrgName = `Test Org ${Date.now()}`;

    const { data: testOrg, error: insertError } = await adminClient
      .from("organizations")
      .insert({
        name: testOrgName,
        settings: { test: true },
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Service role INSERT failed:", insertError.message);
      console.log("\nThis suggests a database-level issue, not just RLS.");
      return;
    }

    console.log("✅ Service role INSERT successful:", testOrg.id);

    // Step 2: Create a test user to verify RLS
    console.log("\n2️⃣ Creating test user to verify RLS...");
    const testEmail = `test${Date.now()}@supersolt.test`;

    const { data: authData, error: signUpError } =
      await normalClient.auth.signUp({
        email: testEmail,
        password: "test123456",
        options: {
          data: {
            first_name: "Test",
            last_name: "User",
          },
        },
      });

    if (signUpError) {
      console.error("❌ Failed to create test user:", signUpError.message);
      // Clean up test org
      await adminClient.from("organizations").delete().eq("id", testOrg.id);
      return;
    }

    const userId = authData.user?.id;
    console.log("✅ Test user created:", userId);

    // Step 3: Test if the user can create an organization
    console.log(
      "\n3️⃣ Testing if authenticated user can INSERT organization...",
    );

    // Set the auth context for the admin client to act as the test user
    const { data: userOrg, error: userInsertError } = await normalClient
      .from("organizations")
      .insert({
        name: `User Test Org ${Date.now()}`,
        settings: { test: true },
      })
      .select()
      .single();

    if (userInsertError) {
      console.error("❌ User INSERT failed:", userInsertError.message);
      console.log("\n⚠️  RLS policies are blocking INSERT operations!");
      console.log("\n🔧 SOLUTION: Run this SQL in Supabase SQL Editor:\n");
      console.log(`-- Drop ALL policies on organizations
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
    END LOOP;
END $$;

-- Create permissive policy for authenticated users
CREATE POLICY "authenticated_users_all"
ON organizations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify the policy
SELECT tablename, policyname, cmd, permissive
FROM pg_policies 
WHERE tablename = 'organizations';`);
    } else {
      console.log("✅ User INSERT successful! RLS is working correctly.");
      // Clean up user org
      await adminClient.from("organizations").delete().eq("id", userOrg.id);
    }

    // Step 4: Clean up
    console.log("\n4️⃣ Cleaning up test data...");

    // Delete test organizations
    await adminClient.from("organizations").delete().eq("id", testOrg.id);

    // Delete test user
    if (userId) {
      await adminClient.auth.admin.deleteUser(userId);
    }

    console.log("✅ Cleanup complete");
  } catch (err) {
    console.error("\n❌ Unexpected error:", err);
  }
}

// Run the fix
fixRLSPolicies();
