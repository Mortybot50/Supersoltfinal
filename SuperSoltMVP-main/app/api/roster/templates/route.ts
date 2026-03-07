import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { shifts, rosters, rosterTemplates, rosterTemplateLines } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  weekday: z.number().int().min(0).max(6).optional().nullable(), // 0 = Sunday, 6 = Saturday
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

/**
 * GET /api/roster/templates
 * List all templates for the active venue
 * Optional filter by weekday
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

    // Verify user has access to this org
    await requireOrg(orgId);

    // Optional weekday filter
    const { searchParams } = new URL(req.url);
    const weekdayParam = searchParams.get("weekday");
    const weekday = weekdayParam ? parseInt(weekdayParam) : null;

    // Query templates
    let query = db
      .select({
        id: rosterTemplates.id,
        name: rosterTemplates.name,
        weekday: rosterTemplates.weekday,
        createdAt: rosterTemplates.createdAt,
        lineCount: sql<number>`(SELECT COUNT(*) FROM ${rosterTemplateLines} WHERE ${rosterTemplateLines.templateId} = ${rosterTemplates.id})`,
      })
      .from(rosterTemplates)
      .where(
        and(
          eq(rosterTemplates.orgId, orgId),
          eq(rosterTemplates.venueId, venueId),
          weekday !== null ? eq(rosterTemplates.weekday, weekday) : undefined
        )
      )
      .$dynamic();

    const templates = await query.execute();

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/templates
 * Save a day's shifts as a reusable template
 * Converts shifts to role blocks with start/end minutes and headcount
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const { name, weekday, sourceDate } = createTemplateSchema.parse(body);

    // Get user's active org and venue from cookies
    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    // Verify user has manager role
    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    // Get source date's roster
    const sourceDateObj = new Date(sourceDate + "T00:00:00Z");
    const dayOfWeek = sourceDateObj.getUTCDay(); // 0 = Sunday

    // Find the Monday of the week containing sourceDate
    const daysToMonday = (dayOfWeek + 6) % 7; // Days back to Monday
    const weekStartDate = new Date(sourceDateObj);
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - daysToMonday);
    const weekStart = weekStartDate.toISOString().split("T")[0];

    // Get roster and shifts for source date
    const sourceRoster = await db
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

    if (sourceRoster.length === 0) {
      return NextResponse.json({ error: "No roster found for source date" }, { status: 404 });
    }

    const rosterId = sourceRoster[0].id;

    // Get all shifts for the source date
    const sourceShifts = await db
      .select({
        id: shifts.id,
        role: shifts.role,
        roleTitle: shifts.roleTitle,
        startTs: shifts.startTs,
        endTs: shifts.endTs,
      })
      .from(shifts)
      .where(eq(shifts.rosterId, rosterId))
      .execute();

    // Filter shifts to only those on the source date
    const sourceDateStr = sourceDate;
    const dayShifts = sourceShifts.filter((shift) => {
      const shiftDate = shift.startTs.toISOString().split("T")[0];
      return shiftDate === sourceDateStr;
    });

    if (dayShifts.length === 0) {
      return NextResponse.json({ error: "No shifts found for source date" }, { status: 404 });
    }

    // Convert shifts to template lines (group by role and time window)
    interface ShiftBlock {
      role: string;
      startMinute: number;
      endMinute: number;
    }

    const shiftBlocks: ShiftBlock[] = dayShifts.map((shift) => {
      const role = shift.role || shift.roleTitle || "Unknown";
      const startMinute = shift.startTs.getUTCHours() * 60 + shift.startTs.getUTCMinutes();
      const endMinute = shift.endTs.getUTCHours() * 60 + shift.endTs.getUTCMinutes();

      return { role, startMinute, endMinute };
    });

    // Group identical blocks and count headcount
    const blockMap = new Map<string, { role: string; startMinute: number; endMinute: number; headcount: number }>();

    for (const block of shiftBlocks) {
      const key = `${block.role}-${block.startMinute}-${block.endMinute}`;
      if (blockMap.has(key)) {
        blockMap.get(key)!.headcount += 1;
      } else {
        blockMap.set(key, { ...block, headcount: 1 });
      }
    }

    const templateLines = Array.from(blockMap.values());

    // Create template and lines in transaction
    const result = await db.transaction(async (tx) => {
      // Create template
      const [template] = await tx
        .insert(rosterTemplates)
        .values({
          orgId,
          venueId,
          name,
          weekday: weekday ?? null,
          createdBy: user.id,
        })
        .returning()
        .execute();

      // Create template lines
      const lines = await tx
        .insert(rosterTemplateLines)
        .values(
          templateLines.map((line) => ({
            templateId: template.id,
            role: line.role,
            startMinute: line.startMinute,
            endMinute: line.endMinute,
            headcount: line.headcount,
          }))
        )
        .returning()
        .execute();

      return {
        template,
        linesCreated: lines.length,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }

    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create template" },
      { status: 500 }
    );
  }
}
