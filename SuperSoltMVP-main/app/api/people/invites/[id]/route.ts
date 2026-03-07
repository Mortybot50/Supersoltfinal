import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { invites, auditLogs } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole, getSessionUser } from "@/lib/authz"
import { cookies } from "next/headers"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    // Ensure user has permission to cancel invites
    await requireRole(orgId, ["owner", "manager"])
    const user = await getSessionUser()

    // Get the invite to verify it exists and belongs to this org
    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.id, params.id), eq(invites.orgId, orgId)))
      .limit(1)

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invites can be cancelled" },
        { status: 400 }
      )
    }

    // Update invite status to cancelled
    await db
      .update(invites)
      .set({ status: "cancelled" })
      .where(and(eq(invites.id, params.id), eq(invites.orgId, orgId)))

    // Create audit log
    await db.insert(auditLogs).values({
      orgId,
      actorUserId: user.id,
      action: "invite.cancelled",
      before: { ...invite, status: "pending" } as Record<string, unknown>,
      after: { ...invite, status: "cancelled" } as Record<string, unknown>,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error cancelling invite:", error)
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json(
      { error: "Failed to cancel invite" },
      { status: 500 }
    )
  }
}
