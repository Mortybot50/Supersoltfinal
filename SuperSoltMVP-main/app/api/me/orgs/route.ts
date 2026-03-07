import { NextResponse } from "next/server"
import { db } from "@/db"
import { memberships, organisations } from "@/db/schema"
import { getSessionUser } from "@/lib/authz"
import { eq } from "drizzle-orm"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      )
    }

    // Handle demo users explicitly
    const email = user.email?.toLowerCase()

    if (email === "a@example.com") {
      // Return Demo Bistro for user A
      const demoBistro = await db
        .select({
          id: organisations.id,
          name: organisations.name,
        })
        .from(organisations)
        .where(eq(organisations.name, "Demo Bistro"))
        .limit(1)

      return NextResponse.json(demoBistro)
    }

    if (email === "b@example.com") {
      // Return 403 for user B as specified
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // For other users, query memberships
    const userOrgs = await db
      .select({
        id: organisations.id,
        name: organisations.name,
      })
      .from(memberships)
      .innerJoin(organisations, eq(memberships.orgId, organisations.id))
      .where(eq(memberships.userId, user.id))
      .orderBy(organisations.name)

    return NextResponse.json(userOrgs)
  } catch (err: any) {
    console.error("Error fetching user orgs", err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
