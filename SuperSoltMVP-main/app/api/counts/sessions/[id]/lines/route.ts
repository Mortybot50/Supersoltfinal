import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { countSessions, countLines } from "@/db/schema";
import { requireOrg, requireRole } from "@/lib/authz";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { sumMovementsInWindow } from "@/lib/usage";

// Schema for updating count lines
const updateLinesSchema = z.object({
  lines: z.array(
    z.object({
      lineId: z.string().uuid(),
      countedBase: z.number().int().min(0),
      notes: z.string().max(512).optional(),
    })
  ),
});

// PATCH /api/counts/sessions/[id]/lines - Update count lines
export async function PATCH(
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
        { error: "Can only update counts for DRAFT sessions" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { lines: lineUpdates } = updateLinesSchema.parse(body);

    // Update each line
    for (const update of lineUpdates) {
      // Get the current line to calculate variance
      const line = await db.query.countLines.findFirst({
        where: and(
          eq(countLines.id, update.lineId),
          eq(countLines.sessionId, sessionId)
        ),
      });

      if (!line) {
        continue; // Skip invalid line IDs
      }

      // Calculate variance: counted - (on_hand_before - theoretical_used + receipts - other_moves)
      // Simplified: variance = counted - expected_on_hand_now
      // Expected = on_hand_before - theoretical_used + movements_in_window
      const movementsInWindow = await sumMovementsInWindow({
        orgId,
        venueId,
        ingredientId: line.ingredientId,
        start: session.startAt,
        end: session.endAt,
      });

      const expectedOnHand =
        line.onHandBeforeBase - line.theoreticalUsedBase + movementsInWindow;
      const varianceBase = update.countedBase - expectedOnHand;

      // Update the line
      await db
        .update(countLines)
        .set({
          countedBase: update.countedBase,
          varianceBase: Math.round(varianceBase),
          notes: update.notes || line.notes,
        })
        .where(eq(countLines.id, update.lineId));
    }

    return NextResponse.json({ success: true, updated: lineUpdates.length });
  } catch (error) {
    console.error("Error updating count lines:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update count lines" },
      { status: 500 }
    );
  }
}
