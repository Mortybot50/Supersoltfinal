export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { users, memberships, invitations } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  const { token, name, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invite = await db.query.invitations.findFirst({
    where: (t, { eq }) => eq(t.tokenHash, tokenHash)
  });

  if (!invite || invite.acceptedAt || new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }

  // Check if user exists
  const email = invite.email.toLowerCase();
  let user = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.email, email) });

  // Security: Don't allow invites to overwrite existing user passwords
  if (user && user.password_hash) {
    return NextResponse.json({ 
      error: "Account already exists. Please use password reset if you've forgotten your password." 
    }, { status: 400 });
  }

  // Create new user or update existing user without password
  if (!user) {
    const hash = await bcrypt.hash(password, 10);
    const inserted = await db.insert(users).values({
      email,
      name: name ?? "",
      password_hash: hash
    }).returning();
    user = inserted[0];
  } else {
    // User exists but has no password (created via different flow)
    const hash = await bcrypt.hash(password, 10);
    await db.update(users).set({
      password_hash: hash,
      name: name ?? user.name
    }).where(eq(users.id, user.id));
  }

  // create membership if missing
  const existing = await db.query.memberships.findFirst({
    where: (t, { eq, and }) => and(eq(t.orgId, invite.orgId), eq(t.userId, user.id))
  });

  if (!existing) {
    await db.insert(memberships).values({
      orgId: invite.orgId,
      userId: user.id,
      role: invite.role as "owner" | "manager" | "supervisor" | "crew"
    });
  }

  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invite.id));

  // Return email for client-side sign-in
  return NextResponse.json({ ok: true, email });
}
