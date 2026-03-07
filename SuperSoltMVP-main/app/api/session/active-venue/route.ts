import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { venues, memberships } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getSessionUser } from "@/lib/authz"

/**
 * GET /api/session/active-venue
 * Returns the active venue and org from HTTP-only cookies
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const venueId = cookieStore.get("activeVenueId")?.value
    const orgId = cookieStore.get("activeOrgId")?.value

    if (!venueId || !orgId) {
      return NextResponse.json({
        venueId: null,
        orgId: null,
      })
    }

    // Get venue details
    const [venue] = await db
      .select()
      .from(venues)
      .where(eq(venues.id, venueId))
      .limit(1)

    return NextResponse.json({
      venueId,
      orgId,
      venueName: venue?.name || null,
    })
  } catch (error) {
    console.error("Error reading active venue:", error)
    return NextResponse.json(
      { error: "Failed to read active venue" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/session/active-venue
 * Sets the active venueId and orgId in HTTP-only cookies after validation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    const body = await request.json()
    const { venueId, orgId } = body

    if (!venueId || !orgId) {
      return NextResponse.json(
        { error: "venueId and orgId are required" },
        { status: 400 }
      )
    }

    // Verify user has access to this org
    const [membership] = await db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.orgId, orgId)
        )
      )
      .limit(1)

    if (!membership) {
      return NextResponse.json(
        { error: "Unauthorized: No access to this organisation" },
        { status: 403 }
      )
    }

    // Verify venue belongs to org
    const [venue] = await db
      .select()
      .from(venues)
      .where(
        and(
          eq(venues.id, venueId),
          eq(venues.orgId, orgId)
        )
      )
      .limit(1)

    if (!venue) {
      return NextResponse.json(
        { error: "Venue not found or does not belong to organisation" },
        { status: 404 }
      )
    }

    // Set HTTP-only cookies for active venue and org
    const response = NextResponse.json({
      ok: true,
      venueId,
      orgId,
      venueName: venue.name,
    })

    response.cookies.set("activeVenueId", venueId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })
    response.cookies.set("activeOrgId", orgId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    })

    return response
  } catch (error: any) {
    console.error("Error setting active venue:", error)
    return NextResponse.json(
      { error: error.message || "Failed to set active venue" },
      { status: error.statusCode || 500 }
    )
  }
}
