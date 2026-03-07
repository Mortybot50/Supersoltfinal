export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { demandOverrides } from "@/db/schema";
import { getActiveContext } from "@/lib/authz";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, props: Params) {
  try {
    const params = await props.params;
    const { venueId } = await getActiveContext();

    await db
      .delete(demandOverrides)
      .where(
        and(
          eq(demandOverrides.id, params.id),
          eq(demandOverrides.venueId, venueId)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("not_authenticated")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("forbidden")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
