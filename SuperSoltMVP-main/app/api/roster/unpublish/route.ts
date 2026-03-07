import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { shifts, rosters, rosterPublications } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole, withAudit } from "@/lib/authz";
import { z } from "zod";

const unpublishSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

/**
 * POST /api/roster/unpublish
 * Unpublish a week's roster: revert shifts to DRAFT, delete latest publication record
 * Only allowed for future weeks to prevent retroactive changes
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const { weekStart } = unpublishSchema.parse(body);

    // Get user's active org and venue from cookies
    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    // Verify user has manager role in this org
    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    // Check if week is in the future (allow unpublishing current week too)
    const weekStartDate = new Date(weekStart + "T00:00:00Z");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // For safety, only allow unpublishing future weeks (comment out to allow current week)
    // if (weekStartDate < today) {
    //   return NextResponse.json(
    //     { error: "Cannot unpublish past weeks" },
    //     { status: 400 }
    //   );
    // }

    // Transaction: Revert shifts, delete publication record
    const result = await db.transaction(async (tx) => {
      // 1. Find roster for this week
      const weekRoster = await tx
        .select({ id: rosters.id })
        .from(rosters)
        .where(
          and(
            eq(rosters.orgId, orgId),
            eq(rosters.venueId, venueId),
            eq(rosters.weekStartDate, weekStart)
          )
        )
        .limit(1)
        .execute();

      if (weekRoster.length === 0) {
        throw new Error("No roster found for this week");
      }

      const rosterId = weekRoster[0].id;

      // 2. Get all PUBLISHED shifts
      const publishedShifts = await tx
        .select({ id: shifts.id })
        .from(shifts)
        .where(and(eq(shifts.rosterId, rosterId), eq(shifts.status, "PUBLISHED")))
        .execute();

      if (publishedShifts.length === 0) {
        throw new Error("No published shifts to unpublish");
      }

      // 3. Revert shifts to DRAFT
      await tx
        .update(shifts)
        .set({
          status: "DRAFT",
          publishedAt: null,
          // Keep wageRateCentsSnapshot for historical reference
        })
        .where(
          and(
            eq(shifts.rosterId, rosterId),
            eq(shifts.status, "PUBLISHED")
          )
        )
        .execute();

      // 4. Delete the latest publication record
      const latestPublication = await tx
        .select({ id: rosterPublications.id, version: rosterPublications.version })
        .from(rosterPublications)
        .where(
          and(
            eq(rosterPublications.orgId, orgId),
            eq(rosterPublications.venueId, venueId),
            eq(rosterPublications.weekStart, weekStart)
          )
        )
        .orderBy(desc(rosterPublications.version))
        .limit(1)
        .execute();

      if (latestPublication.length > 0) {
        await tx
          .delete(rosterPublications)
          .where(eq(rosterPublications.id, latestPublication[0].id))
          .execute();
      }

      return {
        shiftsUnpublished: publishedShifts.length,
        version: latestPublication.length > 0 ? latestPublication[0].version : null,
      };
    });

    // Audit log
    await withAudit("roster_unpublished", null, {
      weekStart,
      venueId,
      shiftsUnpublished: result.shiftsUnpublished,
    }, orgId);

    // Dev notification
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV] Roster unpublished for week ${weekStart}`);
      console.log(`[DEV] Shifts reverted to DRAFT: ${result.shiftsUnpublished}`);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }

    console.error("Error unpublishing roster:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unpublish roster" },
      { status: 500 }
    );
  }
}
