export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { importJobs, importJobRows, importsLog } from "@/db/schema";
import { getActiveContext } from "@/lib/authz";
import { eq } from "drizzle-orm";
import {
  commitIngredients,
  commitMenuItems,
  commitRecipes,
  commitStaff,
  commitSales,
  commitStock,
} from "@/lib/imports/wizard-committers";
import {
  mapIngredients,
  mapMenuItems,
  mapRecipes,
  mapStaff,
  mapSales,
  mapStock,
} from "@/lib/imports/wizard-mappers";

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

/**
 * POST /api/imports/[id]/commit
 * Execute the import with proper committers
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { orgId, venueId, userId } = await getActiveContext();

    // Get job
    const job = await db.query.importJobs.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, params.id), eq(t.venueId, venueId)),
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "ready") {
      return NextResponse.json(
        { error: "Job is not ready to commit", status: job.status },
        { status: 400 }
      );
    }

    // Update job status to importing
    await db.update(importJobs).set({ status: "importing" }).where(eq(importJobs.id, params.id));

    // Reparse FULL CSV from stored text (not just the preview rows)
    if (!job.csvText) {
      throw new Error("CSV text not found in job");
    }
    if (!job.mapping) {
      throw new Error("No mapping configuration found");
    }

    const { parseCsv } = await import("@/lib/imports/wizard-parsers");
    const { rows: allRows } = await parseCsv(job.csvText);

    // Re-run mapping with stored configuration to get ALL normalized data
    const mapper = getMapper(job.type);
    const normalizedRows = mapper(
      allRows,
      job.mapping as Record<string, string>
    );

    // Add original row numbers (1-indexed) to each normalized row
    const rowsWithNumbers = normalizedRows.map((r, idx) => ({
      ...r,
      originalRowNumber: idx + 2, // +2 because CSV row 1 is headers, data starts at row 2
    }));

    // Separate valid and error rows
    const validNormalizedRows = rowsWithNumbers.filter((r) => r.status === "ok");
    const errorRows = rowsWithNumbers.filter((r) => r.status === "error");

    // Collect mapping/validation errors with CORRECT row numbers
    const mappingErrors = errorRows.map((r) => ({
      row: r.originalRowNumber,
      message: r.message || "Validation failed",
    }));

    // Call appropriate committer with ALL valid rows
    let result;
    switch (job.type) {
      case "ingredients":
        result = await commitIngredients(orgId, venueId, validNormalizedRows);
        break;
      case "menu_items":
        result = await commitMenuItems(orgId, venueId, validNormalizedRows);
        break;
      case "recipes":
        result = await commitRecipes(orgId, venueId, validNormalizedRows);
        break;
      case "staff":
        result = await commitStaff(orgId, venueId, validNormalizedRows);
        break;
      case "sales":
        result = await commitSales(orgId, venueId, validNormalizedRows);
        break;
      case "stock":
        result = await commitStock(orgId, venueId, userId, validNormalizedRows);
        break;
      default:
        throw new Error(`Unknown import type: ${job.type}`);
    }

    // Combine committer errors and mapping errors
    const allErrors = [...mappingErrors, ...result.errors];

    // Update job as done
    const finishedAt = new Date();
    const finalStatus = allErrors.length > 0 && result.created === 0 && result.updated === 0 ? "failed" : "done";
    
    await db
      .update(importJobs)
      .set({
        status: finalStatus,
        errorRows: allErrors.length,
        finishedAt,
      })
      .where(eq(importJobs.id, params.id));

    // Note: We don't update individual import_job_rows since we reparsed all rows
    // All error details are captured in allErrors and logged to imports_log

    // Log to imports_log for audit (include ALL errors)
    await db.insert(importsLog).values({
      orgId,
      venueId,
      importType: job.type,
      fileName: job.filename,
      status: finalStatus === "done" ? "success" : "error",
      rowsProcessed: validNormalizedRows.length + errorRows.length,
      rowsInserted: result.created,
      rowsUpdated: result.updated,
      rowsSkipped: result.skipped + errorRows.length,
      errorCount: allErrors.length,
      errorDetails: allErrors,
      importedBy: userId,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped + errorRows.length,
      errors: allErrors,
      status: finalStatus,
      totalRows: allRows.length,
      validRows: validNormalizedRows.length,
      errorRowsCount: errorRows.length,
    });
  } catch (error: unknown) {
    console.error("[Import Commit] Error:", error);

    // Update job as failed
    try {
      await db
        .update(importJobs)
        .set({ status: "failed", finishedAt: new Date() })
        .where(eq(importJobs.id, params.id));
    } catch (e) {
      console.error("Failed to update job status:", e);
    }

    return NextResponse.json(
      { error: "server_error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
