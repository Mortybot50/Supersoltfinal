import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { sendEmail } from "@/lib/mailer";
import { resetTemplate } from "@/lib/email-templates";

export async function POST(req: Request) {
  const { email } = await req.json();
  const user = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.email, email.toLowerCase())
  });

  if (!user) {
    return NextResponse.json({ ok: true }); // don't reveal existence
  }

  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: expires
  });

  const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5000");
  url.pathname = "/auth/reset";
  url.searchParams.set("token", token);

  await sendEmail({
    to: email,
    subject: "Reset your SuperSolt password",
    html: resetTemplate(url.toString())
  });

  return NextResponse.json({ ok: true });
}
