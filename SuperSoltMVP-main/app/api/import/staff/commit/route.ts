export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { cookies } from "next/headers";
import { upsertStaff } from "@/lib/imports/upsert";
import { StaffRow } from "@/lib/imports/schemas";
import { normalizeStaff } from "@/lib/imports/normalize";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;
    const venueId = cookieStore.get("venueId")?.value;

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
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
      const validation = StaffRow.safeParse(parsed[i]);
      
      if (!validation.success) {
        const fieldErrors = validation.error.flatten().fieldErrors;
        const errorMessages = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${msgs?.join(", ")}`)
          .join("; ");
        errors.push({ row: i + 1, message: errorMessages });
        continue;
      }
      
      try {
        const normalizedRow = normalizeStaff(validation.data);
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

    const result = await upsertStaff({ orgId, venueId, rows: normalized });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Staff commit error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
