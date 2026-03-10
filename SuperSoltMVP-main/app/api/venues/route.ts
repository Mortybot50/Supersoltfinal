import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { venues } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireOrg, requireRole, withAudit } from "@/lib/authz"

// GET /api/venues - Returns venues for user's organisations
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    let orgId = searchParams.get("orgId")

    // If no query param, try reading from cookie (new activeOrgId cookie name)
    if (!orgId) {
      const cookieStore = await cookies()
      orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value || null
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing orgId (set it via /api/session/active-venue)" },
        { status: 400 }
      )
    }

    // Check that the user is a member of this org
    await requireOrg(orgId)

    // Fetch venues for this org
    const orgVenues = await db
      .select({
        id: venues.id,
        name: venues.name,
        orgId: venues.orgId,
      })
      .from(venues)
      .where(eq(venues.orgId, orgId))
      .orderBy(venues.name)

    return NextResponse.json(orgVenues)
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/venues
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, timezone } = body

    // Get orgId from cookie (prioritize activeOrgId, fallback to orgId)
    const cookieStore = await cookies()
    const orgId = cookieStore.get("activeOrgId")?.value || cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organisation. Please select an organisation first." },
        { status: 400 }
      )
    }

    if (!name || !timezone) {
      return NextResponse.json(
        { error: "Missing required fields: name, timezone" },
        { status: 400 }
      )
    }

    // Check that the user has owner or manager role
    await requireRole(orgId, ["owner", "manager"])

    // Create the venue
    const [newVenue] = await db
      .insert(venues)
      .values({
        orgId,
        name,
        timezone,
      })
      .returning()

    // Create audit log
    await withAudit(
      "venue.created",
      null,
      { id: newVenue.id, name: newVenue.name, orgId: newVenue.orgId },
      orgId,
      request
    )

    return NextResponse.json(newVenue, { status: 201 })
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error.message?.includes("Forbidden") || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
