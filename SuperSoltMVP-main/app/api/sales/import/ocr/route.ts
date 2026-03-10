import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { requireOrg, requireRole } from "@/lib/authz"

/**
 * OCR endpoint stub - returns 501 Not Implemented
 * Future: Implement Tesseract.js or other OCR solution
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("orgId")?.value

    if (!orgId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 })
    }

    await requireRole(orgId, ["owner", "manager", "supervisor"])

    // Stub response matching expected shape
    return NextResponse.json({
      success: false,
      message: "OCR functionality coming soon. Please use CSV upload for now.",
      imported: 0,
      errors: ["OCR not yet implemented"],
      created: [],
    }, { status: 501 })
  } catch (error: any) {
    console.error("Error in OCR endpoint:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: error.status || 500 })
  }
}
