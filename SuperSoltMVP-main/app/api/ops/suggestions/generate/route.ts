export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { opsSuggestions, venues } from "@/db/schema";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { getWindow } from "@/lib/date-window";
import { runGuardrails, type Suggestion } from "@/lib/guardrails-window";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    await getSessionUser();

    const cookieStore = await cookies();
    const orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("activeVenueId")?.value || cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No organization or venue selected" }, { status: 400 });
    }

    await requireOrg(orgId);

    // Validate venue belongs to org
    const venue = await db
      .select()
      .from(venues)
      .where(and(eq(venues.id, venueId), eq(venues.orgId, orgId)))
      .limit(1);
    
    if (venue.length === 0) {
      return NextResponse.json({ error: "Venue not found or access denied" }, { status: 403 });
    }

    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "week") as "day" | "week" | "month";
    const startISO = url.searchParams.get("start") || new Date().toISOString();

    const { start, end } = getWindow(period, startISO);

    // Run guardrails to generate suggestions
    const suggestions = await runGuardrails({ start, end, period, venueId, orgId });

    // Persist NEW suggestions with idempotency
    const newSuggestions: Suggestion[] = [];

    for (const sug of suggestions) {
      // Check if this exact suggestion already exists as NEW
      const existing = await db
        .select()
        .from(opsSuggestions)
        .where(
          and(
            eq(opsSuggestions.venueId, venueId),
            eq(opsSuggestions.type, sug.type),
            eq(opsSuggestions.title, sug.title),
            eq(opsSuggestions.status, "NEW")
          )
        )
        .limit(1);

      if (existing.length === 0) {
        // Insert new suggestion
        await db.insert(opsSuggestions).values({
          orgId,
          venueId,
          type: sug.type,
          status: "NEW",
          title: sug.title,
          reason: sug.reason || null,
          impact: sug.impact || null,
          payload: sug.payload,
        });

        newSuggestions.push(sug);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        suggestions: newSuggestions,
        total: newSuggestions.length,
        period,
        window: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Generate suggestions error:", e);
    return NextResponse.json(
      { error: e?.message ?? "generate_error" },
      { status: e?.statusCode ?? 500 }
    );
  }
}
