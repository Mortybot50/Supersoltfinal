import { NextResponse } from "next/server"
import { db } from "@/db"
import { users, organisations, memberships, venues } from "@/db/schema"

export async function GET() {
  try {
    const [usersData, organisationsData, membershipsData, venuesData] =
      await Promise.all([
        db.select({ id: users.id, email: users.email }).from(users).limit(20),
        db
          .select({ id: organisations.id, name: organisations.name })
          .from(organisations)
          .limit(20),
        db
          .select({
            id: memberships.id,
            userId: memberships.userId,
            orgId: memberships.orgId,
            role: memberships.role,
          })
          .from(memberships)
          .limit(20),
        db
          .select({
            id: venues.id,
            orgId: venues.orgId,
            name: venues.name,
          })
          .from(venues)
          .limit(20),
      ])

    return NextResponse.json({
      users: usersData,
      organisations: organisationsData,
      memberships: membershipsData,
      venues: venuesData,
    })
  } catch (err: any) {
    console.error("Seed verification error", err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
