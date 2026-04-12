/**
 * POST /api/staff/create
 *
 * Creates a new staff member with the full chain:
 *   1. Creates a placeholder Supabase auth user (no login)
 *   2. Creates a profile record
 *   3. Creates an org_member record
 *   4. Creates a staff record
 *
 * Requires: authenticated user who is an admin of the org.
 */
import type { VercelRequest, VercelResponse } from "../square/_lib.js";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function supabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface CreateStaffBody {
  org_id: string;
  venue_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  role: "manager" | "supervisor" | "crew";
  employment_type: "full_time" | "part_time" | "casual";
  base_hourly_rate?: number; // cents
  award_classification?: string;
  position?: string;
  start_date?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Verify the calling user's auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");
  const db = supabaseAdmin();

  // Verify the token and get the calling user
  const {
    data: { user: callingUser },
    error: authError,
  } = await db.auth.getUser(token);
  if (authError || !callingUser) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const body = req.body as CreateStaffBody;

    if (!body.org_id || !body.first_name) {
      return res
        .status(400)
        .json({ error: "org_id and first_name are required" });
    }
    // last_name may be absent for single-name staff entries
    if (!body.last_name) body.last_name = "";

    // Verify calling user is an admin of this org
    const { data: callerMember } = await db
      .from("org_members")
      .select("id, role")
      .eq("org_id", body.org_id)
      .eq("user_id", callingUser.id)
      .single();

    if (!callerMember || !["admin", "owner"].includes(callerMember.role)) {
      return res
        .status(403)
        .json({ error: "Not authorised — must be org admin" });
    }

    // Generate a placeholder email if none provided
    const staffEmail =
      body.email ||
      `staff-${crypto.randomUUID().slice(0, 8)}@placeholder.supersolt.local`;
    const isPlaceholder = !body.email;

    // 1. Create placeholder auth user (random password, no email confirmation)
    const { data: authUser, error: createUserError } =
      await db.auth.admin.createUser({
        email: staffEmail,
        password: crypto.randomBytes(32).toString("hex"),
        email_confirm: true, // Skip email confirmation
        user_metadata: {
          first_name: body.first_name,
          last_name: body.last_name,
          is_placeholder: isPlaceholder,
        },
      });

    if (createUserError || !authUser.user) {
      console.error(
        "[staff/create] Failed to create auth user:",
        createUserError,
      );
      return res.status(500).json({ error: "Failed to create user account" });
    }

    const userId = authUser.user.id;

    // 2. Upsert profile (trigger may have created one, so upsert)
    const { error: profileError } = await db.from("profiles").upsert(
      {
        id: userId,
        email: staffEmail,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone || null,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      console.error("[staff/create] Failed to create profile:", profileError);
      // Cleanup: delete the auth user
      await db.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: "Failed to create profile" });
    }

    // 3. Create org_member
    const { data: orgMember, error: orgMemberError } = await db
      .from("org_members")
      .insert({
        org_id: body.org_id,
        user_id: userId,
        role: body.role || "crew",
        is_active: true,
      })
      .select("id")
      .single();

    if (orgMemberError || !orgMember) {
      console.error(
        "[staff/create] Failed to create org_member:",
        orgMemberError,
      );
      await db.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: "Failed to create org membership" });
    }

    // 4. Create staff record (include venue_id so venue-scoped queries work)
    const { data: staff, error: staffError } = await db
      .from("staff")
      .insert({
        org_member_id: orgMember.id,
        venue_id: body.venue_id || null,
        employment_type: body.employment_type || "casual",
        base_hourly_rate: body.base_hourly_rate || null,
        award_classification: body.award_classification || null,
        position: body.position || body.role || "crew",
        start_date: body.start_date || new Date().toISOString().split("T")[0],
        onboarding_status: "roster_ready",
      })
      .select("id")
      .single();

    if (staffError || !staff) {
      console.error(
        "[staff/create] Failed to create staff record:",
        staffError,
      );
      // Cleanup chain
      await db.from("org_members").delete().eq("id", orgMember.id);
      await db.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: "Failed to create staff record" });
    }

    // 5. Create venue_access if venue_id provided
    if (body.venue_id) {
      const { error: venueAccessError } = await db.from("venue_access").insert({
        org_member_id: orgMember.id,
        venue_id: body.venue_id,
        role: body.role || "crew",
      });

      if (venueAccessError) {
        console.error(
          "[staff/create] Failed to create venue_access (non-fatal):",
          venueAccessError,
        );
        // Non-fatal — staff record still created
      }
    }

    return res.status(201).json({
      success: true,
      staff_id: staff.id,
      org_member_id: orgMember.id,
      user_id: userId,
      is_placeholder: isPlaceholder,
    });
  } catch (err: unknown) {
    console.error("[staff/create] Unhandled error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
