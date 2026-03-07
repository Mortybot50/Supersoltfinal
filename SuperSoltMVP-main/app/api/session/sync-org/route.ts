import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get orgId from session (stored in JWT)
  const orgId = (session.user as any).orgId;
  
  if (!orgId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  // Set orgId cookie
  const cookieStore = await cookies();
  cookieStore.set("orgId", orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json({ ok: true, orgId });
}
