import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("User authenticated:", user.id);

    // Check if user is admin using has_role function
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc(
      "has_role",
      { _user_id: user.id, _role: "admin" },
    );

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin role" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!isAdmin) {
      console.log("User is not admin");
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("User is admin, proceeding with deletion");

    // Count rows before deletion
    const { count: beforeCount, error: countError } = await supabaseClient
      .from("orders")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("Count error:", countError);
    }

    console.log(`Orders before deletion: ${beforeCount || 0}`);

    // Delete all orders using service role client for full access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Delete all rows (using neq with impossible UUID to match all rows)
    const { error: deleteError } = await supabaseAdmin
      .from("orders")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return new Response(
        JSON.stringify({
          error: "Failed to delete orders",
          details: deleteError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Count rows after deletion
    const { count: afterCount, error: afterCountError } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true });

    if (afterCountError) {
      console.error("After count error:", afterCountError);
    }

    console.log(`Orders after deletion: ${afterCount || 0}`);

    // Log audit entry
    await supabaseAdmin.from("admin_data_audit").insert({
      action: "delete_all_orders",
      actor_user_id: user.id,
      before_counts_json: { orders: beforeCount || 0 },
      after_counts_json: { orders: afterCount || 0 },
      notes: `Deleted all orders from orders table`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount: beforeCount || 0,
        remainingCount: afterCount || 0,
        message: `Successfully deleted ${beforeCount || 0} orders`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
