import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

/**
 * Generate a unique PO number in format PO-YYYY-####
 * Auto-increments per year for the venue
 */
export async function generatePoNumber(
  orgId: string,
  venueId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;

  // Find the highest number for this year and venue
  const result = await db
    .select({ number: purchaseOrders.number })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.orgId, orgId),
        eq(purchaseOrders.venueId, venueId),
        sql`${purchaseOrders.number} LIKE ${prefix + "%"}`
      )
    )
    .orderBy(desc(purchaseOrders.number))
    .limit(1);

  let nextNum = 1;
  if (result.length > 0 && result[0].number) {
    const lastNum = parseInt(result[0].number.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

/**
 * Round up pack quantities (enforced on SEND)
 */
export function ceilPacks(n: number): number {
  return Math.ceil(n);
}

/**
 * Convert pack quantities to base units
 * e.g., 3 packs × 1000g = 3000g
 */
export function toBaseUnits(params: {
  packs: number;
  baseQtyPerPack: number;
}): number {
  return Math.round(params.packs * params.baseQtyPerPack);
}

/**
 * Calculate weighted average cost per base unit
 * @param oldQtyBase - existing stock quantity in base units
 * @param oldAvgCents - existing average cost per base unit in cents
 * @param receiptQtyBase - newly received quantity in base units
 * @param receiptCostCentsPerBase - cost per base unit of the receipt in cents
 * @returns new weighted average cost per base unit in cents
 */
export function calcWeightedAvgCost(
  oldQtyBase: number,
  oldAvgCents: number,
  receiptQtyBase: number,
  receiptCostCentsPerBase: number
): number {
  const totalQty = oldQtyBase + receiptQtyBase;
  if (totalQty === 0) return 0;

  const oldTotal = oldQtyBase * oldAvgCents;
  const newTotal = receiptQtyBase * receiptCostCentsPerBase;

  return Math.round((oldTotal + newTotal) / totalQty);
}
