const { createClient } = require("@supabase/supabase-js");

// Get environment variables
const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://vcfmouckydhsmvfoykms.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixRLSPolicies() {
  console.log("Fixing RLS policies...");

  const sql = `
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
  `;

  try {
    const { data, error } = await supabase.rpc("exec_sql", { query: sql });
    if (error) {
      console.error("Error executing SQL:", error);
      // Try executing statements one by one
      const statements = sql.split(";").filter((s) => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          console.log(`Executing: ${stmt.substring(0, 50)}...`);
          const { error: stmtError } = await supabase.rpc("exec_sql", {
            query: stmt,
          });
          if (stmtError) {
            console.error("Statement error:", stmtError);
          }
        }
      }
    } else {
      console.log("RLS policies fixed successfully!");
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

fixRLSPolicies();
