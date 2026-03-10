import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { invites, users, memberships, staff, auditLogs, type NewUser, type NewMembership, type NewStaff, type NewAuditLog } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json({ error: "Missing required field: token" }, { status: 400 })
    }

    const [invite] = await db
      .select()
      .from(invites)
      .where(eq(invites.token, token))
      .limit(1)

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 })
    }

    if (invite.status === "accepted") {
      return NextResponse.json({ 
        message: "Invite already accepted",
        alreadyAccepted: true 
      }, { status: 200 })
    }

    if (new Date() > invite.expiresAt) {
      await db
        .update(invites)
        .set({ status: "expired" })
        .where(eq(invites.id, invite.id))

      return NextResponse.json({ error: "Invite has expired" }, { status: 400 })
    }

    const normalizedEmail = invite.email.toLowerCase()

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (!user) {
      const newUser: NewUser = {
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
      }
      ;[user] = await db.insert(users).values(newUser).returning()
    }

    const [existingMembership] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.orgId, invite.orgId)))
      .limit(1)

    if (existingMembership) {
      await db
        .update(memberships)
        .set({ role: invite.role })
        .where(eq(memberships.id, existingMembership.id))
    } else {
      const newMembership: NewMembership = {
        userId: user.id,
        orgId: invite.orgId,
        role: invite.role,
      }
      await db.insert(memberships).values(newMembership)
    }

    const [existingStaff] = await db
      .select()
      .from(staff)
      .where(and(eq(staff.email, normalizedEmail), eq(staff.orgId, invite.orgId)))
      .limit(1)

    if (!existingStaff) {
      const newStaff: NewStaff = {
        orgId: invite.orgId,
        name: normalizedEmail.split("@")[0],
        email: normalizedEmail,
        roleTitle: invite.role,
        hourlyRateCents: 0,
        isActive: true,
      }
      await db.insert(staff).values(newStaff)
    }

    await db
      .update(invites)
      .set({ status: "accepted" })
      .where(eq(invites.id, invite.id))

    // Create audit log for invite acceptance
    // Note: actorUserId is the newly created/found user since they're accepting their own invite
    const auditEntry: NewAuditLog = {
      orgId: invite.orgId,
      actorUserId: user.id,
      action: "invite.accepted",
      before: null,
      after: {
        email: invite.email,
        role: invite.role,
        inviteId: invite.id,
      },
    }
    await db.insert(auditLogs).values(auditEntry)

    return NextResponse.json({ 
      message: "Invite accepted successfully",
      userId: user.id,
      orgId: invite.orgId
    }, { status: 200 })
  } catch (error: any) {
    console.error("Error accepting invite:", error)
    const status = error.statusCode || 500
    return NextResponse.json({ error: error.message || "Failed to accept invite" }, { status })
  }
}
