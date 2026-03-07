import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { requireOrg } from "@/lib/authz"

const COOKIE_NAME = "orgId"
const THIRTY_DAYS = 30 * 24 * 60 * 60

export async function GET() {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get(COOKIE_NAME)?.value || null

    return NextResponse.json({ orgId })
  } catch (err: any) {
    console.error("Error reading active-org", err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orgId } = body

    if (!orgId || typeof orgId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid orgId" },
        { status: 400 }
      )
    }

    // Verify membership
    await requireOrg(orgId)

    // Set HTTP-only cookie
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, orgId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: THIRTY_DAYS,
      secure: false, // Set to true in production with HTTPS
    })

    return NextResponse.json({ ok: true, orgId })
  } catch (err: any) {
    if (err.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this organization" },
        { status: 403 }
      )
    }
    console.error("Error setting active-org", err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
