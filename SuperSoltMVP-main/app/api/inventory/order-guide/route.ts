import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { buildOrderGuide } from "@/lib/inventory-ordering";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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
  const venue = await db.select().from(venues).where(and(eq(venues.id, venueId), eq(venues.orgId, orgId))).limit(1);
  if (venue.length === 0) {
    return NextResponse.json({ error: "Venue not found or access denied" }, { status: 403 });
  }

  const url = new URL(req.url);
  const startParam = url.searchParams.get("start");
  const start = startParam ? new Date(startParam) : new Date();
  const days = Number(url.searchParams.get("days") ?? 7);
  const safetyDays = Number(url.searchParams.get("safetyDays") ?? 0);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  const result = await buildOrderGuide({ orgId, venueId, range: { start, end }, safetyDays });

  // Augment each line with packSizeLabel and unitCost
  const enrichedGroups = result.groups.map((group) => ({
    ...group,
    lines: group.lines.map((line) => {
      const packSizeLabel = line.packSize && line.packUnit
        ? `${line.packSize} × ${line.packUnit}`
        : line.packUnit || line.baseUnit;
      const unitCost = line.unitPrice ? Math.round(line.unitPrice * 100) : 0; // convert dollars to cents
      
      return {
        ...line,
        packSizeLabel,
        unitCost,
      };
    }),
  }));

  return NextResponse.json({
    window: {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      days,
      safetyDays,
    },
    groups: enrichedGroups,
    totals: result.totals,
  });
}
