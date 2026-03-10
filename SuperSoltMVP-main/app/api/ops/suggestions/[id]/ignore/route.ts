import { NextResponse } from "next/server";
import { getSessionUser, requireOrg } from "@/lib/authz";
import { db } from "@/db";
import { opsSuggestions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await getSessionUser();
  const { id } = params;

  // Get the suggestion
  const suggestion = await db
    .select()
    .from(opsSuggestions)
    .where(eq(opsSuggestions.id, id))
    .limit(1);

  if (suggestion.length === 0) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  const sug = suggestion[0];
  await requireOrg(sug.orgId);

  if (sug.status !== "NEW") {
    return NextResponse.json({ error: "Suggestion already processed" }, { status: 400 });
  }

  // Mark suggestion as ignored
  await db
    .update(opsSuggestions)
    .set({ status: "IGNORED", decidedAt: new Date() as any })
    .where(eq(opsSuggestions.id, id));

  return NextResponse.json({ ok: true });
}
