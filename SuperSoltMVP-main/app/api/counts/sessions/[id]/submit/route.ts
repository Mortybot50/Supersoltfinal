import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { countSessions } from "@/db/schema";
import { requireOrg, requireRole } from "@/lib/authz";
import { and, eq } from "drizzle-orm";

// POST /api/counts/sessions/[id]/submit - Submit count session for approval
export async function POST(
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
    await requireRole(orgId, ["owner", "manager", "supervisor"]);

    const { id: sessionId } = params;

    // Verify session exists and is in DRAFT status
    const session = await db.query.countSessions.findFirst({
      where: and(
        eq(countSessions.id, sessionId),
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

    if (session.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT sessions can be submitted" },
        { status: 400 }
      );
    }

    // Update status to SUBMITTED
    await db
      .update(countSessions)
      .set({
        status: "SUBMITTED",
        submittedAt: new Date(),
      })
      .where(eq(countSessions.id, sessionId));

    return NextResponse.json({ success: true, status: "SUBMITTED" });
  } catch (error) {
    console.error("Error submitting count session:", error);
    return NextResponse.json(
      { error: "Failed to submit count session" },
      { status: 500 }
    );
  }
}
