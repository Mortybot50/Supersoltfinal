export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { runNightlyJobs } from "@/lib/jobs";

export async function POST(req: Request) {
  try {
    // Require secret header for security
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET || "dev-cron-secret-change-in-prod";
    
    if (cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "unauthorized", message: "Invalid or missing cron secret" },
        { status: 401 }
      );
    }

    await runNightlyJobs({ daysAhead: 14 });
    return NextResponse.json({ ok: true, message: "Nightly jobs completed successfully" });
  } catch (error) {
    console.error("[Cron Nightly] Error:", error);
    return NextResponse.json(
      { error: "nightly_jobs_failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
