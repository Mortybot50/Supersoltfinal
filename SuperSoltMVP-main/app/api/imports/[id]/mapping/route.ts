export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { importJobs, importJobRows } from "@/db/schema";
import { getActiveContext } from "@/lib/authz";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  mapIngredients,
  mapMenuItems,
  mapRecipes,
  mapStaff,
  mapSales,
  mapStock,
} from "@/lib/imports/wizard-mappers";

const mappingSchema = z.object({
  mapping: z.record(z.string()),
});

/**
 * POST /api/imports/[id]/mapping
 * Save column mapping and validate rows
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { venueId } = await getActiveContext();
    const body = await req.json();
    const validated = mappingSchema.parse(body);

    // Get job
    const job = await db.query.importJobs.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, params.id), eq(t.venueId, venueId)),
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Validate required fields for type
    const requiredFields = getRequiredFields(job.type);
    for (const field of requiredFields) {
      if (!validated.mapping[field]) {
        return NextResponse.json(
          { error: "validation_error", message: `Required field missing: ${field}` },
          { status: 400 }
        );
      }
    }

    // Get rows
    const rows = await db.query.importJobRows.findMany({
      where: eq(importJobRows.jobId, params.id),
      orderBy: (t, { asc }) => [asc(t.rowNumber)],
    });

    // Map rows based on type
    const mapper = getMapper(job.type);
    const mappedRows = mapper(
      rows.map((r) => r.dataJson),
      validated.mapping
    );

    // Update row statuses
    let errorCount = 0;
    for (let i = 0; i < mappedRows.length; i++) {
      const mapped = mappedRows[i];
      const rowId = rows[i].id;

      await db
        .update(importJobRows)
        .set({
          status: mapped.status === "ok" ? "ok" : "error",
          message: mapped.message || null,
        })
        .where(eq(importJobRows.id, rowId));

      if (mapped.status === "error") errorCount++;
    }

    // Update job
    const newStatus = errorCount === 0 ? "ready" : "validating";
    await db
      .update(importJobs)
      .set({
        status: newStatus,
        errorRows: errorCount,
        mapping: validated.mapping,
      })
      .where(eq(importJobs.id, params.id));

    // Get error rows for preview
    const errorRows = await db.query.importJobRows.findMany({
      where: (t, { and, eq }) => and(eq(t.jobId, params.id), eq(t.status, "error")),
      limit: 30,
    });

    return NextResponse.json({
      ok: true,
      errorsCount: errorCount,
      status: newStatus,
      preview: errorRows.map((r) => ({
        rowNumber: r.rowNumber,
        message: r.message,
        data: r.dataJson,
      })),
    });
  } catch (error: unknown) {
    console.error("[Import Mapping] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "validation_error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "server_error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function getRequiredFields(type: string): string[] {
  switch (type) {
    case "ingredients":
      return ["name", "purchase_unit"];
    case "menu_items":
      return ["name", "price"];
    case "recipes":
      return ["qty", "unit"]; // Need either menu_item_name or menu_item_id, ingredient_name or ingredient_id
    case "staff":
      return ["name", "email", "role", "hourly_rate"];
    case "sales":
      return ["date", "qty"]; // Need either menu_item_name or menu_item_id
    case "stock":
      return ["qty", "unit"]; // Need either ingredient_name or ingredient_id
    default:
      return [];
  }
}

function getMapper(type: string): (rows: any[], mapping: Record<string, string>) => any[] {
  switch (type) {
    case "ingredients":
      return mapIngredients;
    case "menu_items":
      return mapMenuItems;
    case "recipes":
      return mapRecipes;
    case "staff":
      return mapStaff;
    case "sales":
      return mapSales;
    case "stock":
      return mapStock;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}
