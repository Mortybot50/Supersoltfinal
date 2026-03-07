import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "@/db";
import { dailySales, menuItems } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

const SalesRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  menu_item_name: z.string().min(1),
  quantity_sold: z.coerce.number().int().positive(),
});

type SalesRow = z.infer<typeof SalesRowSchema>;

interface ImportError {
  row: number;
  message: string;
}

/**
 * POST /api/import/sales
 * Import daily sales data from CSV
 * CSV columns: date, menu_item_name, quantity_sold
 * Idempotent: upserts by (venueId, saleDate, menuItemId)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();

    // Get user's active org and venue from cookies
    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    // Verify user has manager role
    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    // Get CSV text from body
    const text = await req.text();

    if (!text || text.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    // Limit file size to 10MB
    if (text.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Parse CSV
    const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    if (parseErrors.length > 0) {
      return NextResponse.json({ 
        error: "CSV parsing failed", 
        details: parseErrors.map(e => e.message) 
      }, { status: 400 });
    }

    // Fetch all menu items for this org once
    const menuItemsMap = new Map<string, string>();
    const orgMenuItems = await db
      .select({ id: menuItems.id, name: menuItems.name })
      .from(menuItems)
      .where(eq(menuItems.orgId, orgId))
      .execute();

    orgMenuItems.forEach(item => {
      menuItemsMap.set(item.name.toLowerCase().trim(), item.id);
    });

    // Validate and process rows
    const errors: ImportError[] = [];
    const validRows: Array<SalesRow & { menuItemId: string }> = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = SalesRowSchema.parse(data[i]);
        
        // Find menu item
        const menuItemId = menuItemsMap.get(row.menu_item_name.toLowerCase().trim());
        if (!menuItemId) {
          errors.push({
            row: i + 2, // +2 for header and 0-indexing
            message: `Menu item not found: "${row.menu_item_name}"`,
          });
          continue;
        }

        validRows.push({
          ...row,
          menuItemId,
        });
      } catch (e) {
        if (e instanceof z.ZodError) {
          errors.push({
            row: i + 2,
            message: e.errors.map(err => `${err.path.join(".")}: ${err.message}`).join(", "),
          });
        } else {
          errors.push({
            row: i + 2,
            message: e instanceof Error ? e.message : "Unknown error",
          });
        }
      }
    }

    // Process valid rows in chunks of 500
    let inserted = 0;
    let updated = 0;
    const chunkSize = 500;

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);

      await db.transaction(async (tx) => {
        for (const row of chunk) {
          // Check if record exists
          const existing = await tx
            .select({ id: dailySales.id })
            .from(dailySales)
            .where(
              and(
                eq(dailySales.orgId, orgId),
                eq(dailySales.venueId, venueId),
                eq(dailySales.saleDate, row.date),
                eq(dailySales.menuItemId, row.menuItemId)
              )
            )
            .limit(1)
            .execute();

          if (existing.length > 0) {
            // Update existing
            await tx
              .update(dailySales)
              .set({
                quantitySold: row.quantity_sold,
              })
              .where(eq(dailySales.id, existing[0].id))
              .execute();
            updated++;
          } else {
            // Insert new
            await tx
              .insert(dailySales)
              .values({
                orgId,
                venueId,
                saleDate: row.date,
                menuItemId: row.menuItemId,
                quantitySold: row.quantity_sold,
              })
              .execute();
            inserted++;
          }
        }
      });
    }

    return NextResponse.json({
      inserted,
      updated,
      skipped: 0,
      total: validRows.length,
      errors,
    });
  } catch (error) {
    console.error("Error importing sales:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import sales" },
      { status: 500 }
    );
  }
}
