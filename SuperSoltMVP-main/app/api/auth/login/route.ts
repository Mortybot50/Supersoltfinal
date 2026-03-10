import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { users, memberships } from "@/db/schema";
import { createSessionForUser } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.email, email.toLowerCase())
  });

  if (!user || !user.password_hash) {
    return NextResponse.json({ error: "bad" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "bad" }, { status: 401 });
  }

  // pick the first org membership by default
  const m = await db.query.memberships.findFirst({
    where: (t, { eq }) => eq(t.userId, user.id)
  });

  if (!m) {
    return NextResponse.json({ error: "no_membership" }, { status: 403 });
  }

  await createSessionForUser(user.id, m.orgId);
  return NextResponse.json({ ok: true });
}
