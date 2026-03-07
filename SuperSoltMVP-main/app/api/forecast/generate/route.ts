import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { ensureDefaultHourProfiles, generateDailyForecast } from "@/lib/forecasting";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
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
  const days = Number(url.searchParams.get("days") ?? 14);
  const startParam = url.searchParams.get("start");
  const start = startParam ? new Date(startParam) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  await ensureDefaultHourProfiles(orgId, venueId);
  await generateDailyForecast({ orgId, venueId, start, end });

  return NextResponse.json({ ok: true, start, end, days });
}
