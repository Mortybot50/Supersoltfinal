import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { getSessionUser, requireOrg, requireRole } from "@/lib/authz";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

const StaffRowSchema = z.object({
  staff_name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  hourly_rate_cents: z.coerce.number().int().positive(),
  active: z.enum(["yes", "no", "true", "false", "1", "0"]).transform(v => 
    v === "yes" || v === "true" || v === "1"
  ).optional().default("yes"),
});

type StaffRow = z.infer<typeof StaffRowSchema>;

interface ImportError {
  row: number;
  message: string;
}

/**
 * POST /api/import/staff
 * Import staff members from CSV
 * CSV columns: staff_name, email, role, hourly_rate_cents, active
 * Idempotent: upserts by (orgId, venueId, email)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();

    const orgId = req.cookies.get("activeOrgId")?.value;
    const venueId = req.cookies.get("activeVenueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No active organization or venue selected" }, { status: 400 });
    }

    await requireOrg(orgId);
    await requireRole(orgId, ["owner", "manager"]);

    const text = await req.text();

    if (!text || text.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }

    if (text.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

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

    // Validate rows
    const errors: ImportError[] = [];
    const validRows: StaffRow[] = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const row = StaffRowSchema.parse(data[i]);
        validRows.push(row);
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

    // Process valid rows in chunks
    let inserted = 0;
    let updated = 0;
    const chunkSize = 200;

    for (let i = 0; i < validRows.length; i += chunkSize) {
      const chunk = validRows.slice(i, i + chunkSize);

      await db.transaction(async (tx) => {
        for (const row of chunk) {
          // Check if staff exists by (orgId, venueId, email) to maintain venue scoping
          const existing = await tx
            .select({ id: staff.id })
            .from(staff)
            .where(
              and(
                eq(staff.orgId, orgId),
                eq(staff.venueId, venueId),
                eq(staff.email, row.email)
              )
            )
            .limit(1)
            .execute();

          if (existing.length > 0) {
            // Update existing staff for this venue
            await tx
              .update(staff)
              .set({
                name: row.staff_name,
                roleTitle: row.role,
                hourlyRateCents: row.hourly_rate_cents,
                isActive: row.active,
              })
              .where(eq(staff.id, existing[0].id))
              .execute();
            updated++;
          } else {
            // Insert new staff for this venue
            await tx
              .insert(staff)
              .values({
                orgId,
                venueId,
                name: row.staff_name,
                email: row.email,
                roleTitle: row.role,
                hourlyRateCents: row.hourly_rate_cents,
                isActive: row.active,
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
    console.error("Error importing staff:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import staff" },
      { status: 500 }
    );
  }
}
