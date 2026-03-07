import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { computeLabourOverlay } from "@/lib/labour-overlay";

/**
 * GET /api/labour/overlay?weekStart=YYYY-MM-DD
 * Calculate hourly labour coverage, cost, and labour % vs forecast for a week
 * Returns hourly grid with headcount by role, costs, revenue, and deficits
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();

    // Get user's active org and venue from cookies
    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    // Verify user has manager role
    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    // Get weekStart from query params
    const { searchParams } = new URL(req.url);
    const weekStart = searchParams.get("weekStart");

    if (!weekStart) {
      return NextResponse.json({ error: "weekStart query parameter is required" }, { status: 400 });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD (Monday)" }, { status: 400 });
    }

    // Compute labour overlay
    const overlay = await computeLabourOverlay({
      orgId,
      venueId,
      weekStart,
    });

    return NextResponse.json(overlay);
  } catch (error) {
    console.error("Error computing labour overlay:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute labour overlay" },
      { status: 500 }
    );
  }
}
