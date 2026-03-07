export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { importJobs, importJobRows } from "@/db/schema";
import { getActiveContext } from "@/lib/authz";
import { parseCsv } from "@/lib/imports/wizard-parsers";
import { z } from "zod";

const createSchema = z.object({
  type: z.enum(["ingredients", "menu_items", "recipes", "staff", "sales", "stock"]),
  filename: z.string(),
  text: z.string(),
});

/**
 * POST /api/imports/create
 * Upload CSV and parse headers
 */
export async function POST(req: NextRequest) {
  try {
    const { venueId, userId } = await getActiveContext();
    const body = await req.json();
    const validated = createSchema.parse(body);

    //Limit size
    if (validated.text.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Parse CSV
    const { headers, rows } = await parseCsv(validated.text);

    if (headers.length === 0) {
      return NextResponse.json({ error: "CSV has no headers" }, { status: 400 });
    }

    // Create import job with full CSV text for reparsing at commit
    const [job] = await db
      .insert(importJobs)
      .values({
        venueId,
        type: validated.type,
        status: "uploaded",
        filename: validated.filename,
        csvText: validated.text, // Store full CSV for later
        totalRows: rows.length,
        createdBy: userId,
      })
      .returning();

    // Store first 200 rows
    const rowsToStore = rows.slice(0, 200);
    const rowRecords = rowsToStore.map((row, idx) => ({
      jobId: job.id,
      rowNumber: idx + 1,
      dataJson: row,
      status: "pending" as const,
    }));

    if (rowRecords.length > 0) {
      await db.insert(importJobRows).values(rowRecords);
    }

    // Return job info with sample
    return NextResponse.json({
      jobId: job.id,
      headers,
      sample: rows.slice(0, 10),
      totalRows: rows.length,
    });
  } catch (error: unknown) {
    console.error("[Import Create] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "validation_error", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not_authenticated")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "server_error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
