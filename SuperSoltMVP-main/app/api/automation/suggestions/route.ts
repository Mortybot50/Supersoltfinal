import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { db } from "@/db";
import { opsSuggestions, venues } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET() {
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

  // Get NEW suggestions
  const suggestions = await db
    .select()
    .from(opsSuggestions)
    .where(
      and(
        eq(opsSuggestions.venueId, venueId),
        eq(opsSuggestions.status, "NEW")
      )
    )
    .orderBy(opsSuggestions.createdAt);

  return NextResponse.json({ items: suggestions });
}
