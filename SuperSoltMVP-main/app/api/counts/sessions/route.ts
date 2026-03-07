import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { countSessions, countLines, ingredients } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import { z } from "zod";
import {
  computeTheoreticalUsage,
  windowSnapshotOnHand,
  getActiveIngredients,
} from "@/lib/usage";

// Schema for creating a new count session
const createSessionSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

// POST /api/counts/sessions - Create new count session
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
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
    await requireRole(orgId, ["owner", "manager"]);

    const body = await request.json();
    const { name, startAt, endAt } = createSessionSchema.parse(body);

    const start = new Date(startAt);
    const end = new Date(endAt);

    // Validate time window
    if (start >= end) {
      return NextResponse.json(
        { error: "Start time must be before end time" },
        { status: 400 }
      );
    }

    // Generate default name if not provided
    const sessionName =
      name ||
      `Weekly Count – ${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;

    // Get active ingredients for this venue/window
    const activeIngredientIds = await getActiveIngredients({
      orgId,
      venueId,
      start,
      end,
    });

    // Get ingredient details
    let ingredientDetails: Array<{ id: string; name: string; unit: string }> = [];
    
    if (activeIngredientIds.length > 0) {
      ingredientDetails = await db
        .select({
          id: ingredients.id,
          name: ingredients.name,
          unit: ingredients.unit,
        })
        .from(ingredients)
        .where(
          and(
            eq(ingredients.orgId, orgId),
            sql`${ingredients.id} = ANY(${sql.array(activeIngredientIds, "uuid")})`
          )
        );
    }

    // Compute theoretical usage for the window
    const theoreticalUsage = await computeTheoreticalUsage({
      orgId,
      venueId,
      start,
      end,
      useForecast: true,
    });

    // Create count session
    const [session] = await db
      .insert(countSessions)
      .values({
        orgId,
        venueId,
        name: sessionName,
        status: "DRAFT",
        startAt: start,
        endAt: end,
        createdBy: user.id,
      })
      .returning();

    // Create count lines for each active ingredient
    const lineInserts = [];
    for (const ing of ingredientDetails) {
      const onHandBefore = await windowSnapshotOnHand({
        orgId,
        venueId,
        ingredientId: ing.id,
        atTime: start,
      });

      const theoreticalUsed = Math.round(theoreticalUsage.get(ing.id) || 0);

      lineInserts.push({
        sessionId: session.id,
        ingredientId: ing.id,
        ingredientName: ing.name,
        baseUom: ing.unit,
        onHandBeforeBase: onHandBefore,
        theoreticalUsedBase: theoreticalUsed,
        countedBase: 0,
        varianceBase: 0,
      });
    }

    if (lineInserts.length > 0) {
      await db.insert(countLines).values(lineInserts);
    }

    return NextResponse.json({ id: session.id, lineCount: lineInserts.length });
  } catch (error) {
    console.error("Error creating count session:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create count session" },
      { status: 500 }
    );
  }
}

// GET /api/counts/sessions - List count sessions
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const conditions = [
      eq(countSessions.orgId, orgId),
      eq(countSessions.venueId, venueId),
    ];

    if (status) {
      conditions.push(eq(countSessions.status, status));
    }

    if (from) {
      conditions.push(gte(countSessions.startAt, new Date(from)));
    }

    if (to) {
      conditions.push(lte(countSessions.endAt, new Date(to)));
    }

    const sessions = await db
      .select({
        id: countSessions.id,
        name: countSessions.name,
        status: countSessions.status,
        startAt: countSessions.startAt,
        endAt: countSessions.endAt,
        createdAt: countSessions.createdAt,
        submittedAt: countSessions.submittedAt,
        approvedAt: countSessions.approvedAt,
        postedAt: countSessions.postedAt,
      })
      .from(countSessions)
      .where(and(...conditions))
      .orderBy(desc(countSessions.startAt));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error listing count sessions:", error);
    return NextResponse.json(
      { error: "Failed to list count sessions" },
      { status: 500 }
    );
  }
}
