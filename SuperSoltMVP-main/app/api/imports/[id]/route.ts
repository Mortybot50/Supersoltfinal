export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { importJobs, importJobRows } from "@/db/schema";
import { getActiveContext } from "@/lib/authz";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/imports/[id]
 * Get job status and error sample
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { venueId } = await getActiveContext();

    // Get job
    const job = await db.query.importJobs.findFirst({
      where: (t, { and, eq }) => and(eq(t.id, params.id), eq(t.venueId, venueId)),
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get error rows (first 30)
    const errorRows = await db.query.importJobRows.findMany({
      where: (t, { and, eq }) => and(eq(t.jobId, params.id), eq(t.status, "error")),
      orderBy: (t, { asc }) => [asc(t.rowNumber)],
      limit: 30,
    });

    return NextResponse.json({
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        filename: job.filename,
        totalRows: job.totalRows,
        errorRows: job.errorRows,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
        mapping: job.mapping,
      },
      errorSample: errorRows.map((r) => ({
        rowNumber: r.rowNumber,
        message: r.message,
        data: r.dataJson,
      })),
    });
  } catch (error: unknown) {
    console.error("[Import Get] Error:", error);
    return NextResponse.json(
      { error: "server_error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
