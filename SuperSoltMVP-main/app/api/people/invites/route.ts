import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { invites, type NewInvite } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole, withAudit } from "@/lib/authz"
import { cookies } from "next/headers"
import { randomUUID } from "crypto"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager"])

    const invitesList = await db
      .select()
      .from(invites)
      .where(and(eq(invites.orgId, orgId), eq(invites.status, "pending")))

    return NextResponse.json(invitesList)
  } catch (error: any) {
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json({ error: "Missing required fields: email, role" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (!["owner", "manager", "supervisor", "crew"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const existingInvite = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.orgId, orgId),
          eq(invites.email, normalizedEmail),
          eq(invites.status, "pending")
        )
      )
      .limit(1)

    if (existingInvite.length > 0) {
      return NextResponse.json(
        { error: "A pending invite already exists for this email" },
        { status: 409 }
      )
    }

    const token = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 14)

    const newInvite: NewInvite = {
      orgId,
      email: normalizedEmail,
      role,
      token,
      status: "pending",
      expiresAt,
    }

    const [created] = await db.insert(invites).values(newInvite).returning()

    await withAudit("invite.create", null, created as Record<string, unknown>, orgId, request)

    return NextResponse.json({ token, invite: created }, { status: 201 })
  } catch (error: any) {
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message }, { status })
  }
}
