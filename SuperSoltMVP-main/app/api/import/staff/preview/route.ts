export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { cookies } from "next/headers";
import { parseCsv } from "@/lib/imports/csv";
import { StaffRow } from "@/lib/imports/schemas";
import { normalizeStaff } from "@/lib/imports/normalize";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const orgId = cookieStore.get("orgId")?.value;

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    await requireRole(orgId, ["manager", "owner"]);

    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 5MB." }, { status: 413 });
    }

    const text = await req.text();
    const { rows, errors } = parseCsv(text);

    if (errors.length > 0) {
      return NextResponse.json({
        parsed: [],
        errors: errors.map((e) => ({ row: 0, message: e })),
      });
    }

    if (rows.length > 10000) {
      return NextResponse.json(
        { error: "Too many rows. Maximum 10,000 rows per upload." },
        { status: 400 }
      );
    }

    const parsed = [];
    const rowErrors: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const validation = StaffRow.safeParse(r);
      
      if (!validation.success) {
        const fieldErrors = validation.error.flatten().fieldErrors;
        const errorMessages = Object.entries(fieldErrors)
          .map(([field, msgs]) => `${field}: ${msgs?.join(", ")}`)
          .join("; ");
        rowErrors.push({ row: i + 2, message: errorMessages });
        continue;
      }
      
      try {
        const normalized = normalizeStaff(validation.data);
        parsed.push(normalized);
      } catch (error: any) {
        rowErrors.push({ row: i + 2, message: error.message });
      }
    }

    return NextResponse.json({
      orgId,
      parsed,
      errors: rowErrors.slice(0, 100),
      totalErrors: rowErrors.length,
    });
  } catch (error: any) {
    console.error("Staff preview error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
