export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const row = await db.query.passwordResetTokens.findFirst({
    where: (t, { eq, and, isNull, gt }) =>
      and(
        eq(t.tokenHash, tokenHash),
        isNull(t.usedAt),
        gt(t.expiresAt, new Date())
      )
  });

  if (!row) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  await db.update(users).set({ password_hash: hash }).where(eq(users.id, row.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));

  return NextResponse.json({ ok: true });
}
