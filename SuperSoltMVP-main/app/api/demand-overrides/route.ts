export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { demandOverrides } from "@/db/schema";
import { getActiveContext } from "@/lib/authz";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  multiplier: z.number().min(0.1).max(5),
  reason: z.string().optional(),
});

export async function GET() {
  try {
    const { venueId } = await getActiveContext();

    const overrides = await db
      .select()
      .from(demandOverrides)
      .where(eq(demandOverrides.venueId, venueId))
      .orderBy(demandOverrides.startsAt);

    return NextResponse.json(overrides);
  } catch (error: unknown) {
    console.error("[Demand Overrides GET] Error:", error);
    if (error instanceof Error && error.message.includes("not_authenticated")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("forbidden")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "server_error", message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { venueId, userId } = await getActiveContext();
    const body = await req.json();
    const validated = createSchema.parse(body);

    const [override] = await db
      .insert(demandOverrides)
      .values({
        venueId,
        startsAt: new Date(validated.startsAt),
        endsAt: new Date(validated.endsAt),
        multiplier: validated.multiplier.toString(),
        reason: validated.reason,
        createdBy: userId,
      })
      .returning();

    return NextResponse.json(override);
  } catch (error: unknown) {
    console.error("[Demand Overrides POST] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "validation_error", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not_authenticated")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("forbidden")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "server_error", message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
