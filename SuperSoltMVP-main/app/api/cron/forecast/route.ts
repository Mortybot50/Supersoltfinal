export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { generateForecastsForVenue } from "@/lib/jobs";
import { getActiveContext } from "@/lib/authz";

export async function POST(req: Request) {
  try {
    // Allow both authenticated users and cron secret
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.CRON_SECRET || "dev-cron-secret-change-in-prod";
    
    let venueId: string;
    
    if (cronSecret === expectedSecret) {
      // Cron job mode - get venueId from query param
      const url = new URL(req.url);
      const venueIdParam = url.searchParams.get("venueId");
      if (!venueIdParam) {
        return NextResponse.json({ error: "venueId required for cron mode" }, { status: 400 });
      }
      venueId = venueIdParam;
    } else {
      // User mode - get venueId from active context (requires auth)
      const context = await getActiveContext();
      venueId = context.venueId;
    }
    
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") ?? 14);
    
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    
    await generateForecastsForVenue({ venueId, start, days });
    
    return NextResponse.json({ 
      ok: true, 
      message: `Forecasts regenerated for next ${days} days` 
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("No active venue")) {
      return NextResponse.json({ error: "no_venue_selected" }, { status: 400 });
    }
    if (error instanceof Error && (error as any).statusCode === 401) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    console.error("[Cron Forecast] Error:", error);
    return NextResponse.json(
      { error: "forecast_failed", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
