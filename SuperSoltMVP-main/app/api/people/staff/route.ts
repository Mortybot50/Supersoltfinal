import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { staff, type NewStaff, type Staff } from "@/db/schema"
import { requireOrg, requireRole, withAudit } from "@/lib/authz"

/**
 * GET /api/people/staff
 * Returns staff for the active org (and active venue if present).
 */
export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value
    const venueId = cookieStore.get("venueId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      )
    }

    await requireOrg(orgId)

    const where = venueId
      ? and(eq(staff.orgId, orgId), eq(staff.venueId, venueId))
      : eq(staff.orgId, orgId)

    const rows = await db.select().from(staff).where(where)
    return NextResponse.json(rows)
  } catch (err: any) {
    const status = err?.statusCode ?? 500
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status }
    )
  }
}

/**
 * POST /api/people/staff
 * Creates a staff member bound to the **active venue** (from cookie).
 * Body: { name, email, phone?, roleTitle, hourlyRateCents }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value
    const venueId = cookieStore.get("venueId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      )
    }
    if (!venueId) {
      return NextResponse.json(
        { error: "No venue selected (set it via /api/session/active-venue)" },
        { status: 400 }
      )
    }

    // Owners/managers only
    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const { name, email, phone, roleTitle, hourlyRateCents } = body ?? {}

    if (!name || !email || !roleTitle || hourlyRateCents === undefined) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: name, email, roleTitle, hourlyRateCents",
        },
        { status: 400 }
      )
    }

    const newRow: NewStaff = {
      orgId,
      venueId, // <-- always from cookie
      name,
      email,
      phone: phone ?? null,
      roleTitle,
      hourlyRateCents: Number(hourlyRateCents),
      isActive: true,
    }

    const [created] = await db.insert(staff).values(newRow).returning()

    await withAudit(
      "staff.create",
      null,
      created as Record<string, unknown>,
      orgId,
      request
    )

    return NextResponse.json(created, { status: 201 })
  } catch (err: any) {
    const status = err?.statusCode ?? 500
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status }
    )
  }
}

/**
 * PUT /api/people/staff
 * Updates a staff member within the active org (and implicitly scoped to venue).
 * Body: { id, name?, email?, phone?, roleTitle?, hourlyRateCents?, isActive? }
 */
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value
    const venueId = cookieStore.get("venueId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      )
    }
    if (!venueId) {
      return NextResponse.json(
        { error: "No venue selected (set it via /api/session/active-venue)" },
        { status: 400 }
      )
    }

    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const { id, name, email, phone, roleTitle, hourlyRateCents, isActive } =
      body ?? {}

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      )
    }

    // Ensure the staff record belongs to this org (+ venue where applicable)
    const [existing] = await db
      .select()
      .from(staff)
      .where(
        and(
          eq(staff.id, id),
          eq(staff.orgId, orgId),
          eq(staff.venueId, venueId)
        )
      )
      .limit(1)

    if (!existing) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      )
    }

    const updates: Partial<Staff> = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (roleTitle !== undefined) updates.roleTitle = roleTitle
    if (hourlyRateCents !== undefined)
      updates.hourlyRateCents = Number(hourlyRateCents)
    if (isActive !== undefined) updates.isActive = Boolean(isActive)

    const [updated] = await db
      .update(staff)
      .set(updates)
      .where(eq(staff.id, id))
      .returning()

    await withAudit(
      "staff.update",
      existing as Record<string, unknown>,
      updated as Record<string, unknown>,
      orgId,
      request
    )

    return NextResponse.json(updated)
  } catch (err: any) {
    const status = err?.statusCode ?? 500
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status }
    )
  }
}
