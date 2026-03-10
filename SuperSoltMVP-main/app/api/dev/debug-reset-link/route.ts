export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const url = new URL(req.url);
  const email = String(url.searchParams.get("email") || "").toLowerCase();
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const user = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, email) });
  if (!user) return NextResponse.json({ error: "unknown_user" }, { status: 404 });

  const token = await db.query.passwordResetTokens.findFirst({
    where: (t, { eq }) => eq(t.userId, user.id),
    orderBy: (t) => [desc(t.createdAt)]
  });
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 404 });

  return NextResponse.json({
    hint: "Use console [DEV EMAIL] output in dev. Hash shown here for reference only.",
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    usedAt: token.usedAt
  });
}
