import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { shifts, rosters, rosterPublications, staff } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole, withAudit } from "@/lib/authz";
import { z } from "zod";

const publishSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

/**
 * POST /api/roster/publish
 * Publish a week's roster: set shifts to PUBLISHED, snapshot wage rates, create publication record
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const { weekStart } = publishSchema.parse(body);

    // Get user's active org and venue from cookies
    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    // Verify user has manager role in this org
    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    // Calculate week end (Sunday)
    const weekStartDate = new Date(weekStart + "T00:00:00Z");
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
    const weekEnd = weekEndDate.toISOString().split("T")[0];

    // Transaction: Update shifts, create publication record
    const result = await db.transaction(async (tx) => {
      // 1. Find all DRAFT shifts for this week
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

      // 2. Get all DRAFT shifts with staff wage rates and existing snapshots
      const draftShifts = await tx
        .select({
          id: shifts.id,
          staffId: shifts.staffId,
          existingSnapshot: shifts.wageRateCentsSnapshot,
          staffHourlyRateCents: staff.hourlyRateCents,
        })
        .from(shifts)
        .leftJoin(staff, eq(staff.id, shifts.staffId))
        .where(and(eq(shifts.rosterId, rosterId), eq(shifts.status, "DRAFT")))
        .execute();

      if (draftShifts.length === 0) {
        throw new Error("No draft shifts to publish");
      }

      // 3. Update each shift: set PUBLISHED, snapshot wage rate ONLY if not already snapshotted
      // This preserves historical wage data when re-publishing after unpublish
      for (const shift of draftShifts) {
        await tx
          .update(shifts)
          .set({
            status: "PUBLISHED",
            publishedAt: new Date(),
            // Only snapshot if not already set (preserves original published rate)
            wageRateCentsSnapshot: shift.existingSnapshot ?? shift.staffHourlyRateCents ?? 0,
          })
          .where(eq(shifts.id, shift.id))
          .execute();
      }

      // 4. Check if week already published (get max version)
      const existingPublications = await tx
        .select({ version: rosterPublications.version })
        .from(rosterPublications)
        .where(
          and(
            eq(rosterPublications.orgId, orgId),
            eq(rosterPublications.venueId, venueId),
            eq(rosterPublications.weekStart, weekStart)
          )
        )
        .orderBy(sql`${rosterPublications.version} DESC`)
        .limit(1)
        .execute();

      const nextVersion = existingPublications.length > 0 ? existingPublications[0].version + 1 : 1;

      // 5. Create publication record
      const [publication] = await tx
        .insert(rosterPublications)
        .values({
          orgId,
          venueId,
          weekStart,
          version: nextVersion,
          publishedBy: user.id,
        })
        .returning()
        .execute();

      // 6. Send notifications (dev: console log, production: Resend)
      const isDev = process.env.NODE_ENV === "development" || !process.env.RESEND_API_KEY;

      if (isDev) {
        console.log(`[DEV EMAIL] Roster published for week ${weekStart}`);
        console.log(`[DEV EMAIL] Version: ${nextVersion}`);
        console.log(`[DEV EMAIL] Shifts published: ${draftShifts.length}`);
        console.log(`[DEV EMAIL] Staff would receive notifications here`);
      } else {
        // TODO: Send Resend emails to staff with shift details
        // For now, just log
        console.log(`Roster published: ${draftShifts.length} shifts for week ${weekStart}`);
      }

      return {
        publicationId: publication.id,
        version: nextVersion,
        shiftsPublished: draftShifts.length,
      };
    });

    // Audit log
    await withAudit("roster_published", null, {
      weekStart,
      venueId,
      version: result.version,
      shiftsPublished: result.shiftsPublished,
    }, orgId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }

    console.error("Error publishing roster:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to publish roster" },
      { status: 500 }
    );
  }
}
