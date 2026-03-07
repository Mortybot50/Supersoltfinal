import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchaseOrders, suppliers } from "@/db/schema";
import { requireRole } from "@/lib/authz";
import { eq, and, desc, or, like, gte, lte } from "drizzle-orm";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json(
        { error: "Organization and venue must be selected" },
        { status: 400 }
      );
    }

    await requireRole(orgId, ["owner", "manager", "supervisor"]);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const supplierId = searchParams.get("supplierId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");

    // Build WHERE conditions
    const conditions = [
      eq(purchaseOrders.orgId, orgId),
      eq(purchaseOrders.venueId, venueId),
    ];

    if (status) {
      conditions.push(eq(purchaseOrders.status, status));
    }

    if (supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, supplierId));
    }

    if (dateFrom) {
      conditions.push(gte(purchaseOrders.createdAt, new Date(dateFrom)));
    }

    if (dateTo) {
      conditions.push(lte(purchaseOrders.createdAt, new Date(dateTo)));
    }

    if (search) {
      conditions.push(like(purchaseOrders.number, `%${search}%`));
    }

    // Fetch POs with supplier info
    const pos = await db
      .select({
        id: purchaseOrders.id,
        number: purchaseOrders.number,
        status: purchaseOrders.status,
        expectedDate: purchaseOrders.expectedDate,
        subtotalCents: purchaseOrders.subtotalCents,
        taxCents: purchaseOrders.taxCents,
        totalCents: purchaseOrders.totalCents,
        createdAt: purchaseOrders.createdAt,
        sentAt: purchaseOrders.sentAt,
        receivedAt: purchaseOrders.receivedAt,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(100);

    return NextResponse.json({ pos });
  } catch (error: any) {
    console.error("Error fetching purchase orders:", error);

    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: "Failed to fetch purchase orders" },
      { status: 500 }
    );
  }
}
