import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sql, and, eq, gte, lte } from "drizzle-orm";
import { dailySales, menuItems, shifts, staff, rosters } from "@/db/schema";
import { getMenuItemCost } from "@/lib/costing";
import { getSessionUser, requireOrg } from "@/lib/authz";

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
  // Use locale-agnostic formatting to avoid timezone shifts
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(req: Request) {
  try {
    await getSessionUser();

    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    await requireOrg(orgId);

    const url = new URL(req.url);
    const venueId = url.searchParams.get("venueId") || cookieStore.get("venueId")?.value || null;
    const period = (url.searchParams.get("period") || "week") as "day" | "week" | "month";
    const startParam = url.searchParams.get("start");
    const startInput = startParam ? new Date(startParam) : new Date();

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

    const periodStartStr = toDateString(periodStart);
    const periodEndStr = toDateString(periodEnd);

    const salesRes = await db
      .select({ value: sql<number>`COALESCE(SUM(${dailySales.quantitySold} * ${menuItems.priceCents}), 0)` })
      .from(dailySales)
      .leftJoin(menuItems, eq(dailySales.menuItemId, menuItems.id))
      .where(
        and(
          eq(dailySales.orgId, orgId),
          gte(dailySales.saleDate, periodStartStr),
          lte(dailySales.saleDate, periodEndStr),
          venueId ? eq(dailySales.venueId, venueId) : sql`TRUE`
        )
      );

    const sales = Number(salesRes?.[0]?.value ?? 0) / 100;

    let cogsPct: number | null = null;
    try {
      const salesData = await db
        .select({
          menuItemId: dailySales.menuItemId,
          qty: sql<number>`SUM(${dailySales.quantitySold})`,
        })
        .from(dailySales)
        .where(
          and(
            eq(dailySales.orgId, orgId),
            gte(dailySales.saleDate, periodStartStr),
            lte(dailySales.saleDate, periodEndStr),
            venueId ? eq(dailySales.venueId, venueId) : sql`TRUE`
          )
        )
        .groupBy(dailySales.menuItemId);

      let totalCost = 0;
      for (const sale of salesData) {
        const cost = await getMenuItemCost(sale.menuItemId, orgId);
        if (cost !== null) {
          totalCost += (cost / 100) * Number(sale.qty);
        }
      }

      cogsPct = sales > 0 ? +((100 * totalCost) / sales).toFixed(1) : null;
    } catch (e) {
      cogsPct = null;
    }

    let labourPct: number | null = null;
    try {
      const labourRes = await db
        .select({
          value: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (${shifts.endTs} - ${shifts.startTs}))/3600 * ${staff.hourlyRateCents}),0)`,
        })
        .from(shifts)
        .leftJoin(rosters, eq(shifts.rosterId, rosters.id))
        .leftJoin(staff, eq(shifts.staffId, staff.id))
        .where(
          and(
            eq(rosters.orgId, orgId),
            gte(shifts.startTs, periodStart),
            lte(shifts.startTs, periodEnd),
            venueId ? eq(rosters.venueId, venueId) : sql`TRUE`
          )
        );

      const labour = Number(labourRes?.[0]?.value ?? 0) / 100;
      labourPct = sales > 0 ? +((100 * labour) / sales).toFixed(1) : null;
    } catch (e) {
      labourPct = null;
    }

    return NextResponse.json(
      {
        sales,
        cogsPct,
        labourPct,
        period,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("KPI error:", e);
    return NextResponse.json({ error: "kpi_error" }, { status: 500 });
  }
}
