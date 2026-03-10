import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { db } from "@/db";
import { rosterSuggestions, venues } from "@/db/schema";
import { and, eq } from "drizzle-orm";

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export async function GET(req: Request) {
  await getSessionUser();

  const cookieStore = await cookies();
  const orgId = cookieStore.get("orgId")?.value;
  const venueId = cookieStore.get("venueId")?.value;

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
  const weekStartParam = url.searchParams.get("weekStart");
  const weekStart = weekStartParam ? new Date(weekStartParam) : new Date();
  const ws = startOfWeek(weekStart);

  const rows = await db
    .select()
    .from(rosterSuggestions)
    .where(and(eq(rosterSuggestions.venueId, venueId), eq(rosterSuggestions.weekStart, ws as any)));

  return NextResponse.json({ items: rows });
}
