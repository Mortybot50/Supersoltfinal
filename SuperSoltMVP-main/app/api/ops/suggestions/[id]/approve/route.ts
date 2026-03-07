import { NextResponse } from "next/server";
import { getSessionUser, requireOrg, withAudit } from "@/lib/authz";
import { db } from "@/db";
import { opsSuggestions, menuItems, shifts, auditLogs } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  const { id } = params;

  // Get the suggestion
  const suggestion = await db
    .select()
    .from(opsSuggestions)
    .where(eq(opsSuggestions.id, id))
    .limit(1);

  if (suggestion.length === 0) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const sug = suggestion[0];
  await requireOrg(sug.orgId);

  if (sug.status !== "NEW") {
    return NextResponse.json({ error: "Suggestion already processed" }, { status: 400 });
  }

  const payload = sug.payload as any;

  // Execute action based on type
  switch (sug.type) {
    case "PRICE_NUDGE": {
      // Update menu item price
      const newPriceCents = Math.round(payload.suggestedPrice * 100);
      await db
        .update(menuItems)
        .set({ priceCents: newPriceCents })
        .where(eq(menuItems.id, payload.menuItemId));

      // Audit log
      await withAudit({
        orgId: sug.orgId,
        actorUserId: user.id,
        action: "ops.suggestion.approve.price_nudge",
        after: {
          suggestionId: sug.id,
          menuItemId: payload.menuItemId,
          oldPrice: payload.currentPrice,
          newPrice: payload.suggestedPrice,
        },
      });
      break;
    }

    case "ORDER_SHORTFALL": {
      // No external ordering yet; just mark as approved
      // Future: Create a purchase order
      await withAudit({
        orgId: sug.orgId,
        actorUserId: user.id,
        action: "ops.suggestion.approve.order_shortfall",
        after: {
          suggestionId: sug.id,
          ingredientId: payload.ingredientId,
          supplierId: payload.supplierId,
          packs: payload.packs,
        },
      });
      break;
    }

    case "LABOUR_ADD": {
      // Find the roster for this week
      const startAt = new Date(payload.startAt);
      const weekStartStr = startAt.toISOString().split("T")[0];
      
      // Get or create roster
      const roster = await db.execute(sql`
        SELECT id FROM rosters 
        WHERE org_id = ${sug.orgId} 
          AND venue_id = ${sug.venueId} 
          AND week_start_date = ${weekStartStr}
        LIMIT 1
      `);

      let rosterId: string;
      if (roster.rows.length === 0) {
        const newRoster = await db.execute(sql`
          INSERT INTO rosters (org_id, venue_id, week_start_date)
          VALUES (${sug.orgId}, ${sug.venueId}, ${weekStartStr})
          RETURNING id
        `);
        rosterId = (newRoster.rows[0] as any).id;
      } else {
        rosterId = (roster.rows[0] as any).id;
      }

      // Insert draft shifts
      const deltaHeadcount = Math.abs(payload.deltaHeadcount);
      for (let i = 0; i < deltaHeadcount; i++) {
        await db.insert(shifts).values({
          rosterId,
          staffId: null, // Manager assigns later
          roleTitle: payload.role,
          role: payload.role,
          status: "draft",
          startTs: new Date(payload.startAt) as any,
          endTs: new Date(payload.endAt) as any,
          breakMinutes: 0,
        });
      }

      await withAudit({
        orgId: sug.orgId,
        actorUserId: user.id,
        action: "ops.suggestion.approve.labour_add",
        after: {
          suggestionId: sug.id,
          role: payload.role,
          shifts: deltaHeadcount,
        },
      });
      break;
    }

    case "LABOUR_TRIM": {
      // Mark shifts as candidates for removal (status = "suggest_trim")
      // Find overlapping shifts for this role and time block
      const startAt = new Date(payload.startAt);
      const endAt = new Date(payload.endAt);
      const weekStartStr = startAt.toISOString().split("T")[0];

      // Get roster
      const roster = await db.execute(sql`
        SELECT id FROM rosters 
        WHERE org_id = ${sug.orgId} 
          AND venue_id = ${sug.venueId} 
          AND week_start_date = ${weekStartStr}
        LIMIT 1
      `);

      if (roster.rows.length > 0) {
        const rosterId = (roster.rows[0] as any).id;
        const deltaHeadcount = Math.abs(payload.deltaHeadcount);

        // Update up to deltaHeadcount shifts to suggest_trim status
        await db.execute(sql`
          UPDATE shifts
          SET status = 'suggest_trim'
          WHERE id IN (
            SELECT id FROM shifts
            WHERE roster_id = ${rosterId}
              AND role = ${payload.role}
              AND start_ts < ${endAt}
              AND end_ts > ${startAt}
            LIMIT ${deltaHeadcount}
          )
        `);
      }

      await withAudit({
        orgId: sug.orgId,
        actorUserId: user.id,
        action: "ops.suggestion.approve.labour_trim",
        after: {
          suggestionId: sug.id,
          role: payload.role,
          shifts: Math.abs(payload.deltaHeadcount),
        },
      });
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown suggestion type" }, { status: 400 });
  }

  // Mark suggestion as approved
  await db
    .update(opsSuggestions)
    .set({ status: "APPROVED", decidedAt: new Date() as any })
    .where(eq(opsSuggestions.id, id));

  return NextResponse.json({ ok: true, type: sug.type });
}
