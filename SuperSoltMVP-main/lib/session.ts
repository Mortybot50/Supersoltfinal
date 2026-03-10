import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { nanoid } from "nanoid";

export async function createSessionForUser(userId: string, orgId: string) {
  const sessionToken = nanoid(32);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(sessions).values({
    sessionToken,
    userId,
    expires,
  });

  const cookieStore = await cookies();
  cookieStore.set("next-auth.session-token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });

  cookieStore.set("orgId", orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax",
    path: "/",
  });
}
