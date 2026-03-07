import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";
import { rosters, rosterTemplates, rosterTemplateLines, shifts, labourRules } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { z } from "zod";

const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

/**
 * POST /api/roster/templates/apply
 * Apply a template to a target date, creating DRAFT shifts
 * Respects labour rules for open/close hours
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const { templateId, targetDate } = applyTemplateSchema.parse(body);

    // Get user's active org and venue from cookies
    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    // Verify user has manager role
    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    // Get template and verify ownership
    const template = await db
      .select()
      .from(rosterTemplates)
      .where(
        and(
          eq(rosterTemplates.id, templateId),
          eq(rosterTemplates.orgId, orgId),
          eq(rosterTemplates.venueId, venueId)
        )
      )
      .limit(1)
      .execute();

    if (template.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Get template lines
    const templateLines = await db
      .select()
      .from(rosterTemplateLines)
      .where(eq(rosterTemplateLines.templateId, templateId))
      .execute();

    if (templateLines.length === 0) {
      return NextResponse.json({ error: "Template has no lines" }, { status: 400 });
    }

    // Get labour rules for validation (open/close hours)
    const rules = await db
      .select()
      .from(labourRules)
      .where(and(eq(labourRules.orgId, orgId), eq(labourRules.venueId, venueId)))
      .limit(1)
      .execute();

    const openHour = rules.length > 0 ? rules[0].openHour : 9;
    const closeHour = rules.length > 0 ? rules[0].closeHour : 22;

    // Find or create roster for target week
    const targetDateObj = new Date(targetDate + "T00:00:00Z");
    const dayOfWeek = targetDateObj.getUTCDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const weekStartDate = new Date(targetDateObj);
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - daysToMonday);
    const weekStart = weekStartDate.toISOString().split("T")[0];

    // Create shifts in transaction
    const result = await db.transaction(async (tx) => {
      // Find or create roster for target week
      let rosterResult = await tx
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

      let rosterId: string;

      if (rosterResult.length === 0) {
        // Create roster
        const [newRoster] = await tx
          .insert(rosters)
          .values({
            orgId,
            venueId,
            weekStartDate: weekStart,
          })
          .returning()
          .execute();

        rosterId = newRoster.id;
      } else {
        rosterId = rosterResult[0].id;
      }

      // Create shifts from template lines
      const shiftsToCreate = [];

      for (const line of templateLines) {
        // Convert minutes to hours for validation
        const startHour = Math.floor(line.startMinute / 60);
        const endHour = Math.floor(line.endMinute / 60);

        // Skip shifts outside operating hours
        if (startHour < openHour || endHour > closeHour) {
          console.log(`Skipping shift outside operating hours: ${line.role} ${startHour}:00-${endHour}:00`);
          continue;
        }

        // Create headcount number of shifts
        for (let i = 0; i < line.headcount; i++) {
          // Build timestamps for target date
          const startTs = new Date(targetDate + "T00:00:00Z");
          startTs.setUTCMinutes(line.startMinute);

          const endTs = new Date(targetDate + "T00:00:00Z");
          endTs.setUTCMinutes(line.endMinute);

          // Handle overnight shifts (endMinute < startMinute)
          if (line.endMinute < line.startMinute) {
            endTs.setUTCDate(endTs.getUTCDate() + 1);
          }

          shiftsToCreate.push({
            rosterId,
            staffId: null, // Unassigned
            roleTitle: line.role,
            role: line.role,
            status: "DRAFT" as const,
            startTs,
            endTs,
            breakMinutes: 0,
          });
        }
      }

      if (shiftsToCreate.length === 0) {
        throw new Error("No valid shifts to create from template");
      }

      // Insert all shifts
      const createdShifts = await tx.insert(shifts).values(shiftsToCreate).returning().execute();

      return {
        shiftsCreated: createdShifts.length,
        rosterId,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
    }

    console.error("Error applying template:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply template" },
      { status: 500 }
    );
  }
}
