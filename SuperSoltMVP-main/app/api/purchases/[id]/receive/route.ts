import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  purchaseOrders,
  purchaseOrderLines,
  stockMovements,
  ingredients,
} from "@/db/schema";
import { requireRole, withAudit } from "@/lib/authz";
import { toBaseUnits, calcWeightedAvgCost } from "@/lib/purchasing";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

const ReceivePoSchema = z.object({
  lines: z.array(
    z.object({
      lineId: z.string().uuid(),
      packsReceived: z.number().positive(),
      packCostCents: z.number().nonnegative().optional(),
    })
  ),
  occurredAt: z.string().optional(),
  allowOverReceive: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Parse and validate body
    const body = await request.json();
    const { lines: receivedLines, occurredAt, allowOverReceive } =
      ReceivePoSchema.parse(body);

    // Fetch PO
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, id),
          eq(purchaseOrders.orgId, orgId),
          eq(purchaseOrders.venueId, venueId)
        )
      )
      .limit(1);

    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (po.status !== "SENT" && po.status !== "PARTIAL") {
      return NextResponse.json(
        { error: "Purchase order must be SENT or PARTIAL to receive" },
        { status: 400 }
      );
    }

    // Fetch all PO lines
    const allLines = await db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.poId, id));

    // Process each received line
    let totalBaseQty = 0;
    const processedLineIds: string[] = [];

    for (const receivedLine of receivedLines) {
      const line = allLines.find((l) => l.id === receivedLine.lineId);

      if (!line) {
        return NextResponse.json(
          { error: `Line ${receivedLine.lineId} not found in this PO` },
          { status: 400 }
        );
      }

      const currentReceived = parseFloat(line.packsReceived);
      const newReceived = currentReceived + receivedLine.packsReceived;
      const ordered = parseFloat(line.packsOrdered);

      // Check for over-receive
      if (!allowOverReceive && newReceived > ordered) {
        return NextResponse.json(
          {
            error: `Cannot receive ${newReceived} packs for line ${receivedLine.lineId}. Only ${ordered} ordered.`,
          },
          { status: 400 }
        );
      }

      // Calculate receipt in base units
      const receiptQtyBase = toBaseUnits({
        packs: receivedLine.packsReceived,
        baseQtyPerPack: line.baseQtyPerPack,
      });

      totalBaseQty += receiptQtyBase;

      // Determine cost per base unit
      const costToUse = receivedLine.packCostCents ?? line.packCostCents;
      const unitCostCents = Math.round(costToUse / line.baseQtyPerPack);

      // Fetch current ingredient stock and cost
      const [ingredient] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.id, line.ingredientId))
        .limit(1);

      if (!ingredient) {
        return NextResponse.json(
          { error: `Ingredient ${line.ingredientId} not found` },
          { status: 400 }
        );
      }

      const oldStockBase = Math.round(
        parseFloat(ingredient.currentStockLevel) *
          (ingredient.unit === "g" || ingredient.unit === "ml" ? 1 : 1)
      );
      const oldAvgCostCents = ingredient.costPerUnitCents;

      // Calculate new weighted average cost
      const newAvgCostCents = calcWeightedAvgCost(
        oldStockBase,
        oldAvgCostCents,
        receiptQtyBase,
        unitCostCents
      );

      const newStockBase = oldStockBase + receiptQtyBase;

      // Update ingredient stock and cost
      await db
        .update(ingredients)
        .set({
          currentStockLevel: String(newStockBase),
          costPerUnitCents: newAvgCostCents,
        })
        .where(eq(ingredients.id, line.ingredientId));

      // Create stock movement record
      await db.insert(stockMovements).values({
        orgId,
        venueId,
        ingredientId: line.ingredientId,
        type: "RECEIPT",
        qtyBase: receiptQtyBase,
        unitCostCents,
        refType: "PO",
        refId: po.id,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      });

      // Update PO line received quantity
      await db
        .update(purchaseOrderLines)
        .set({
          packsReceived: String(newReceived),
        })
        .where(eq(purchaseOrderLines.id, line.id));

      processedLineIds.push(line.id);
    }

    // Check if all lines are fully received
    const updatedLines = await db
      .select()
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.poId, id));

    const allReceived = updatedLines.every(
      (line) => parseFloat(line.packsReceived) >= parseFloat(line.packsOrdered)
    );

    const newStatus = allReceived ? "RECEIVED" : "PARTIAL";
    const poUpdates: any = { status: newStatus };

    if (allReceived) {
      poUpdates.receivedAt = new Date();
    }

    await db
      .update(purchaseOrders)
      .set(poUpdates)
      .where(eq(purchaseOrders.id, id));

    // Audit log
    await withAudit(
      "po_receive",
      { poId: id, status: po.status },
      {
        poId: id,
        status: newStatus,
        linesReceived: processedLineIds.length,
        totalBaseQty,
      },
      orgId,
      request
    );

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    console.error("Error receiving purchase order:", error);

    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to receive purchase order" },
      { status: 500 }
    );
  }
}
