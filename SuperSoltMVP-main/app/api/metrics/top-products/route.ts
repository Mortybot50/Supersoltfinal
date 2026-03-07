import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import { dailySales, menuItems } from "@/db/schema";
import { requireOrg } from "@/lib/authz";

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() + diff);
  return s;
}

function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  s.setHours(23, 59, 59, 999);
  return s;
}

function startOfDay(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function endOfDay(d: Date) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function startOfMonth(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  s.setHours(0, 0, 0, 0);
  return s;
}

function endOfMonth(d: Date) {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  e.setHours(23, 59, 59, 999);
  return e;
}

function toDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computePeriodDates(period: "day" | "week" | "month", startInput: Date) {
  let periodStart: Date;
  let periodEnd: Date;

  if (period === "day") {
    periodStart = startOfDay(startInput);
    periodEnd = endOfDay(startInput);
  } else if (period === "week") {
    periodStart = startOfWeek(startInput);
    periodEnd = endOfWeek(startInput);
  } else {
    periodStart = startOfMonth(startInput);
    periodEnd = endOfMonth(startInput);
  }

  return { periodStart, periodEnd };
}

function computePreviousPeriod(periodStart: Date, periodEnd: Date) {
  const diffMs = periodEnd.getTime() - periodStart.getTime();
  const prevEnd = new Date(periodStart.getTime() - 1); // 1ms before current start
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return { prevStart, prevEnd };
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("activeVenueId")?.value || cookieStore.get("venueId")?.value;

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    if (!venueId) {
      return NextResponse.json({ error: "No venue selected" }, { status: 400 });
    }

    await requireOrg(orgId);

    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "week") as "day" | "week" | "month";
    const startParam = url.searchParams.get("start");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const startInput = startParam ? new Date(startParam) : new Date();

    // Compute current period
    const { periodStart, periodEnd } = computePeriodDates(period, startInput);
    const periodStartStr = toDateString(periodStart);
    const periodEndStr = toDateString(periodEnd);

    // Compute previous period
    const { prevStart, prevEnd } = computePreviousPeriod(periodStart, periodEnd);
    const prevStartStr = toDateString(prevStart);
    const prevEndStr = toDateString(prevEnd);

    // First, calculate total revenue for the entire period (no LIMIT)
    const totalResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${dailySales.quantitySold} * ${menuItems.priceCents}), 0)`,
      })
      .from(dailySales)
      .innerJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(
        and(
          eq(dailySales.orgId, orgId),
          eq(dailySales.venueId, venueId),
          gte(dailySales.saleDate, periodStartStr),
          lte(dailySales.saleDate, periodEndStr)
        )
      );

    const totalCents = Number(totalResult[0]?.total ?? 0);

    // Get top N products for current period
    const currentSales = await db
      .select({
        menuItemId: dailySales.menuItemId,
        name: menuItems.name,
        valueCents: sql<number>`SUM(${dailySales.quantitySold} * ${menuItems.priceCents})`,
        qty: sql<number>`SUM(${dailySales.quantitySold})`,
      })
      .from(dailySales)
      .innerJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(
        and(
          eq(dailySales.orgId, orgId),
          eq(dailySales.venueId, venueId),
          gte(dailySales.saleDate, periodStartStr),
          lte(dailySales.saleDate, periodEndStr)
        )
      )
      .groupBy(dailySales.menuItemId, menuItems.name)
      .orderBy(sql`SUM(${dailySales.quantitySold} * ${menuItems.priceCents}) DESC`)
      .limit(limit);

    // Aggregate sales for previous period (all products, not limited)
    const previousSales = await db
      .select({
        menuItemId: dailySales.menuItemId,
        valueCents: sql<number>`SUM(${dailySales.quantitySold} * ${menuItems.priceCents})`,
      })
      .from(dailySales)
      .innerJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(
        and(
          eq(dailySales.orgId, orgId),
          eq(dailySales.venueId, venueId),
          gte(dailySales.saleDate, prevStartStr),
          lte(dailySales.saleDate, prevEndStr)
        )
      )
      .groupBy(dailySales.menuItemId);

    // Create lookup map for previous period
    const prevMap = new Map<string, number>();
    for (const item of previousSales) {
      prevMap.set(item.menuItemId, Number(item.valueCents));
    }

    // Build response with percentages and deltas
    const items = currentSales.map((item) => {
      const currValue = Number(item.valueCents);
      const prevValue = prevMap.get(item.menuItemId) ?? 0;
      const pctOfSales = totalCents > 0 ? (currValue / totalCents) * 100 : 0;
      const changeRatio = prevValue > 0 ? (currValue - prevValue) / prevValue : null;

      return {
        id: item.menuItemId,
        name: item.name,
        value_cents: currValue,
        pct_of_sales: pctOfSales,
        change_ratio: changeRatio,
      };
    });

    return NextResponse.json(
      {
        total_cents: totalCents,
        items,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("Top products error:", e);
    return NextResponse.json({ error: "top_products_error" }, { status: 500 });
  }
}
