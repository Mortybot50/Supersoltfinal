import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { seedOrganization } from "../../supabase/seed";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow demo seeding in production

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);

    // Verify token and get user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Seed the demo organization
    const result = await seedOrganization(user.id);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to seed demo data",
    });
  }
}
