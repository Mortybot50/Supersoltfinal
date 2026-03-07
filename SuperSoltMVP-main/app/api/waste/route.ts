export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { toBase } from "@/lib/units";
import { getIngredientUnitCostCentsSnapshot } from "@/lib/costing";
import { db } from "@/db";
import { wasteEvents, stockMovements, venues, ingredients } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";

const CreateWasteSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  ingredientId: z.string(),
  qty: z.coerce.number().positive(),
  unit: z.enum(["g", "kg", "ml", "l", "each"]),
  reason: z.enum(["prep", "spoilage", "overportion", "transfer", "theft", "other"]).default("spoilage"),
  note: z.string().optional(),
});

const ListWasteSchema = z.object({
  start: z.string(),
  end: z.string(),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();

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

    const body = CreateWasteSchema.parse(await req.json());
    const day = new Date(body.date);
    day.setHours(0, 0, 0, 0);

    // CRITICAL: Validate ingredient belongs to the active org (tenant isolation)
    const ingredient = await db
      .select()
      .from(ingredients)
      .where(and(eq(ingredients.id, body.ingredientId), eq(ingredients.orgId, orgId)))
      .limit(1);

    if (ingredient.length === 0) {
      return NextResponse.json(
        { error: "Ingredient not found or access denied" },
        { status: 403 }
      );
    }

    const base = toBase(body.qty, body.unit);
    const unitCostCents = await getIngredientUnitCostCentsSnapshot({
      venueId,
      ingredientId: body.ingredientId,
      at: day,
    });

    // Insert waste event
    const [evt] = await db
      .insert(wasteEvents)
      .values({
        orgId,
        venueId,
        date: day,
        ingredientId: body.ingredientId,
        qty: body.qty.toString(),
        unit: body.unit,
        reason: body.reason,
        note: body.note ?? null,
        unitCostCentsSnapshot: unitCostCents ?? null,
        qtyBase: Math.round(base.qty),
        createdBy: user.id,
      })
      .returning();

    // Create negative stock movement
    await db.insert(stockMovements).values({
      orgId,
      venueId,
      ingredientId: body.ingredientId,
      type: "waste",
      qtyBase: -Math.round(base.qty),
      unitCostCents: unitCostCents ?? 0,
      refType: "waste_event",
      refId: evt.id,
    });

    const totalCostCents = unitCostCents ? Math.round(unitCostCents * base.qty) : null;

    return NextResponse.json(
      {
        ok: true,
        event: evt,
        costCents: totalCostCents,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("Waste creation error:", e);
    return NextResponse.json(
      { error: e?.message ?? "waste_create_failed" },
      { status: e?.statusCode ?? 500 }
    );
  }
}

export async function GET(req: Request) {
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
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "start and end dates required" }, { status: 400 });
    }

    const params = ListWasteSchema.parse({ start, end });

    const startD = new Date(params.start);
    startD.setHours(0, 0, 0, 0);
    const endD = new Date(params.end);
    endD.setHours(23, 59, 59, 999);

    // Fetch waste events with ingredient names
    const rows = await db
      .select({
        id: wasteEvents.id,
        date: wasteEvents.date,
        ingredientId: wasteEvents.ingredientId,
        ingredientName: sql<string>`COALESCE(${ingredients.name}, 'Unknown')`,
        qty: wasteEvents.qty,
        unit: wasteEvents.unit,
        reason: wasteEvents.reason,
        unitCostCents: wasteEvents.unitCostCentsSnapshot,
        note: wasteEvents.note,
      })
      .from(wasteEvents)
      .leftJoin(ingredients, eq(ingredients.id, wasteEvents.ingredientId))
      .where(
        and(
          eq(wasteEvents.venueId, venueId),
          gte(wasteEvents.date, startD),
          lte(wasteEvents.date, endD)
        )
      )
      .orderBy(sql`${wasteEvents.date} DESC, ${wasteEvents.createdAt} DESC`);

    // Calculate aggregates
    let totalCostCents = 0;
    const byIngredientMap: Record<
      string,
      { ingredientId: string; ingredientName: string; costCents: number }
    > = {};

    for (const r of rows) {
      const qty = parseFloat(r.qty);
      const baseQty =
        r.unit === "kg" ? qty * 1000 : r.unit === "l" ? qty * 1000 : qty;

      const costCents = r.unitCostCents
        ? Math.round(r.unitCostCents * baseQty)
        : 0;

      totalCostCents += costCents;

      const key = r.ingredientId || "unknown";
      if (!byIngredientMap[key]) {
        byIngredientMap[key] = {
          ingredientId: key,
          ingredientName: r.ingredientName,
          costCents: 0,
        };
      }
      byIngredientMap[key].costCents += costCents;
    }

    const byIngredient = Object.values(byIngredientMap).sort(
      (a, b) => b.costCents - a.costCents
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        date: r.date,
        ingredientId: r.ingredientId,
        ingredientName: r.ingredientName,
        qty: r.qty,
        unit: r.unit,
        reason: r.reason,
        unitCostCents: r.unitCostCents,
        note: r.note,
      })),
      totals: {
        totalCostCents,
        byIngredient,
      },
    });
  } catch (e: any) {
    console.error("Waste list error:", e);
    return NextResponse.json(
      {
        items: [],
        totals: { totalCostCents: 0, byIngredient: [] },
      },
      { status: 200 }
    );
  }
}
