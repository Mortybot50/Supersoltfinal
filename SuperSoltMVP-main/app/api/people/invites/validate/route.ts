import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { invites, organisations } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    const [invite] = await db
      .select({
        email: invites.email,
        role: invites.role,
        orgId: invites.orgId,
        expiresAt: invites.expiresAt,
        status: invites.status,
      })
      .from(invites)
      .where(eq(invites.token, token))
      .limit(1)

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 })
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invite has already been used" }, { status: 400 })
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 })
    }

    const [org] = await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, invite.orgId))
      .limit(1)

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      orgName: org?.name || "Unknown Organization",
      expiresAt: invite.expiresAt.toISOString(),
      status: invite.status,
    })
  } catch (error: any) {
    console.error("Error validating invite:", error)
    return NextResponse.json(
      { error: error.message || "Failed to validate invite" },
      { status: 500 }
    )
  }
}
