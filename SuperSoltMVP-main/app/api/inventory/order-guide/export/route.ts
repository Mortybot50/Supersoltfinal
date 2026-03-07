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

  const { groups } = await buildOrderGuide({ orgId, venueId, range: { start, end }, safetyDays });

  const rows: string[] = [];
  rows.push(
    [
      "Supplier",
      "Ingredient",
      "Required (base)",
      "On hand",
      "Shortfall (base)",
      "Pack size",
      "Pack unit",
      "Packs",
      "Unit price",
      "Est. cost",
    ].join(",")
  );

  for (const g of groups) {
    for (const l of g.lines) {
      rows.push(
        [
          g.supplierName,
          l.ingredientName,
          l.requiredUnits,
          l.onHandUnits,
          l.shortfallUnits,
          l.packSize ?? "",
          l.packUnit ?? "",
          l.packsRecommended,
          l.unitPrice ?? "",
          l.estCost,
        ].join(",")
      );
    }
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=order_guide_${start.toISOString().split("T")[0]}.csv`,
    },
  });
}
