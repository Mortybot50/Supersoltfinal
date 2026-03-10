export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id))
    .limit(1);
  
  const m = rows[0];
  if (!m) {
    return NextResponse.json({ error: "no_membership" }, { status: 400 });
  }

  // Get first venue for this org
  const { venues } = await import("@/db/schema");
  const venueRows = await db
    .select()
    .from(venues)
    .where(eq(venues.orgId, m.orgId))
    .limit(1);
  
  const venue = venueRows[0];
  if (!venue) {
    return NextResponse.json({ error: "no_venue" }, { status: 400 });
  }

  const cookieStore = await cookies();
  
  // Set both new and legacy cookie names for compatibility
  cookieStore.set("activeOrgId", String(m.orgId), { httpOnly: true, path: "/" });
  cookieStore.set("activeVenueId", String(venue.id), { httpOnly: true, path: "/" });
  cookieStore.set("orgId", String(m.orgId), { httpOnly: true, path: "/" });
  cookieStore.set("venueId", String(venue.id), { httpOnly: true, path: "/" });

  return NextResponse.json({ 
    ok: true, 
    orgId: m.orgId, 
    venueId: venue.id 
  });
}
