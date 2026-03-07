import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getSessionUser, requireRole } from "@/lib/authz";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { sendEmail } from "@/lib/mailer";
import { inviteTemplate } from "@/lib/email-templates";

export async function POST(req: Request) {
  const { email, role } = await req.json();
  
  // Get orgId from session cookie
  const cookieStore = await cookies();
  const orgId = cookieStore.get("orgId")?.value;
  
  if (!orgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  // Require manager or owner role in the active org
  await requireRole(orgId, ["manager", "owner"]);
  
  const sessionUser = await getSessionUser();

  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  await db.insert(invitations).values({
    orgId,
    email,
    role,
    inviterId: sessionUser.id,
    tokenHash,
    expiresAt: expires
  });

  const url = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5000");
  url.pathname = "/auth/accept";
  url.searchParams.set("token", token);

  await sendEmail({
    to: email,
    subject: "You're invited to SuperSolt",
    html: inviteTemplate(url.toString())
  });

  return NextResponse.json({ ok: true });
}
