export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { cookies } from "next/headers";
import { upsertSalesDaily } from "@/lib/imports/upsert";
import { SalesDailyRow } from "@/lib/imports/schemas";
import { normalizeSalesDaily } from "@/lib/imports/normalize";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("venueId")?.value;

    if (!orgId || !venueId) {
      return NextResponse.json({ error: "No organization or venue selected" }, { status: 400 });
    }

    await requireRole(orgId, ["manager", "owner"]);

    const body = await req.json();
    const { parsed } = body;

    if (!parsed || !Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // SERVER-SIDE VALIDATION: Re-validate and normalize all rows
    const normalized = [];
    const errors: any[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const validation = SalesDailyRow.safeParse(parsed[i]);
      
      if (!validation.success) {
        const fieldErrors = validation.error.flatten().fieldErrors;
        const errorMessages = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${msgs?.join(", ")}`)
          .join("; ");
        errors.push({ row: i + 1, message: errorMessages });
        continue;
      }
      
      try {
        const normalizedRow = normalizeSalesDaily(validation.data);
        normalized.push(normalizedRow);
      } catch (error: any) {
        errors.push({ row: i + 1, message: error.message });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: "Validation failed", 
        errors,
        created: 0,
        updated: 0,
        unchanged: 0
      }, { status: 400 });
    }

    const result = await upsertSalesDaily({ orgId, venueId, rows: normalized });

    // Trigger forecast generation for imported date range
    if (result.created > 0 || result.updated > 0) {
      const dates = normalized.map((r) => new Date(r.date));
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
      const daysDiff = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Trigger forecast generation (idempotent) - fire and forget
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      fetch(`${appUrl}/api/forecast/generate?start=${minDate.toISOString().split("T")[0]}&days=${daysDiff}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch((err) => console.error("Forecast generation trigger failed:", err));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Sales commit error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
