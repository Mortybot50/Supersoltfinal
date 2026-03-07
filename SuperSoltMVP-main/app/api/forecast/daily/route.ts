import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { dailySales, menuItems, salesForecasts, venues } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { ensureDefaultHourProfiles, generateDailyForecast } from "@/lib/forecasting";

export const runtime = "nodejs";

export async function GET(req: Request) {
  await getSessionUser();

  const cookieStore = await cookies();
  const orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value;
  const venueId = cookieStore.get("activeVenueId")?.value || cookieStore.get("venueId")?.value;

  if (!orgId || !venueId) {
    return NextResponse.json({ error: "No organization or venue selected" }, { status: 400 });
  }

  await requireOrg(orgId);

  // Validate venue belongs to org
  const venue = await db.select().from(venues).where(and(eq(venues.id, venueId), eq(venues.orgId, orgId))).limit(1);
  if (venue.length === 0) {
    return NextResponse.json({ error: "Venue not found or access denied" }, { status: 403 });
  }

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start");
  const start = startParam ? new Date(startParam) : new Date();
  const days = Number(url.searchParams.get("days") ?? 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  // Always ensure forecasts exist for the requested window (enables historical comparison)
  try {
    await ensureDefaultHourProfiles(orgId, venueId);
    await generateDailyForecast({ orgId, venueId, start, end });
  } catch (error) {
    console.error("Forecast generation failed:", error);
    // Continue anyway - forecast generation is opportunistic
  }

  // Actual revenue per day
  const actual = await db
    .select({
      date: dailySales.saleDate,
      revenue: sql<number>`COALESCE(SUM(${dailySales.quantitySold} * ${menuItems.priceCents}), 0)`,
    })
    .from(dailySales)
    .leftJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
    .where(
      and(
        gte(dailySales.saleDate, start.toISOString().split("T")[0]),
        lte(dailySales.saleDate, end.toISOString().split("T")[0]),
        eq(dailySales.venueId, venueId)
      )
    )
    .groupBy(dailySales.saleDate)
    .orderBy(dailySales.saleDate);

  // Forecast revenue per day: sum(qty * price)
  const forecast = await db
    .select({
      date: salesForecasts.date,
      revenue: sql<number>`COALESCE(SUM(CAST(${salesForecasts.qty} AS numeric) * ${menuItems.priceCents}), 0)`,
    })
    .from(salesForecasts)
    .leftJoin(menuItems, eq(salesForecasts.menuItemId, menuItems.id))
    .where(
      and(
        gte(salesForecasts.date, start),
        lte(salesForecasts.date, end),
        eq(salesForecasts.venueId, venueId)
      )
    )
    .groupBy(salesForecasts.date)
    .orderBy(salesForecasts.date);

  // Always return 200 with data (empty arrays if no data)
  return NextResponse.json(
    {
      actual: actual ?? [],
      forecast: forecast ?? [],
      start,
      end,
      days
    },
    { status: 200 }
  );
}
