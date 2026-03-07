export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { db } from "@/db";
import { wasteEvents, stockMovements, venues } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
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

    const id = params.id;

    // Delete the waste event (this is tenant-scoped)
    const [evt] = await db
      .delete(wasteEvents)
      .where(and(eq(wasteEvents.id, id), eq(wasteEvents.venueId, venueId)))
      .returning();

    if (!evt) {
      return NextResponse.json({ error: "Waste event not found" }, { status: 404 });
    }

    // Delete the associated stock movement
    await db
      .delete(stockMovements)
      .where(
        and(
          eq(stockMovements.refId, id),
          eq(stockMovements.refType, "waste_event"),
          eq(stockMovements.venueId, venueId)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Waste delete error:", e);
    return NextResponse.json(
      { error: e?.message ?? "waste_delete_failed" },
      { status: e?.statusCode ?? 500 }
    );
  }
}
