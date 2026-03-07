import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { countSessions, countLines } from "@/db/schema";
import { requireOrg } from "@/lib/authz";
import { and, eq } from "drizzle-orm";

// GET /api/counts/sessions/[id] - Get session details with lines
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json(
        { error: "Organization and venue must be selected" },
        { status: 400 }
      );
    }

    await requireOrg(orgId);

    const { id } = params;

    // Get session header
    const session = await db.query.countSessions.findFirst({
      where: and(
        eq(countSessions.id, id),
        eq(countSessions.orgId, orgId),
        eq(countSessions.venueId, venueId)
      ),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Count session not found" },
        { status: 404 }
      );
    }

    // Get session lines
    const lines = await db.query.countLines.findMany({
      where: eq(countLines.sessionId, id),
    });

    return NextResponse.json({
      ...session,
      lines,
    });
  } catch (error) {
    console.error("Error fetching count session:", error);
    return NextResponse.json(
      { error: "Failed to fetch count session" },
      { status: 500 }
    );
  }
}
