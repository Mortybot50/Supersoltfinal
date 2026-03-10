import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { importSuggestionsAsDraft } from "@/lib/labour-planning";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
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
  weekStart.setHours(0, 0, 0, 0);

  const res = await importSuggestionsAsDraft({ orgId, venueId, weekStart });

  return NextResponse.json({ ok: true, ...res });
}
