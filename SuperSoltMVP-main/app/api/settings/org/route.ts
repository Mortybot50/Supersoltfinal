import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { organisationSettings } from "@/db/schema"
import { eq } from "drizzle-orm"
import { requireOrg, requireRole, withAudit } from "@/lib/authz"
import { z } from "zod"

// Validation schema for org settings
const orgSettingsSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  targetCogsPct: z.number().int().min(0).max(100).optional(),
  targetLabourPct: z.number().int().min(0).max(100).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(), // 0=Sunday, 1=Monday...6=Saturday
})

/**
 * GET /api/settings/org
 * Returns effective organisation settings
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("activeOrgId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organisation" },
        { status: 400 }
      )
    }

    // Check user has access to this org
    await requireOrg(orgId)

    // Get org settings, or create defaults if not exists
    let [settings] = await db
      .select()
      .from(organisationSettings)
      .where(eq(organisationSettings.orgId, orgId))
      .limit(1)

    // If no settings exist, create defaults
    if (!settings) {
      ;[settings] = await db
        .insert(organisationSettings)
        .values({ orgId })
        .returning()
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error("Error fetching org settings:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch organisation settings" },
      { status: error.statusCode || 500 }
    )
  }
}

/**
 * PATCH /api/settings/org
 * Updates organisation settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const orgId = cookieStore.get("activeOrgId")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organisation" },
        { status: 400 }
      )
    }

    // Require owner or manager role
    await requireRole(orgId, ["owner", "manager"])

    const body = await request.json()
    const validated = orgSettingsSchema.parse(body)

    // Get current settings for audit log
    const [currentSettings] = await db
      .select()
      .from(organisationSettings)
      .where(eq(organisationSettings.orgId, orgId))
      .limit(1)

    // Update or insert settings
    let updatedSettings
    if (currentSettings) {
      ;[updatedSettings] = await db
        .update(organisationSettings)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(organisationSettings.orgId, orgId))
        .returning()
    } else {
      ;[updatedSettings] = await db
        .insert(organisationSettings)
        .values({
          orgId,
          ...validated,
        })
        .returning()
    }

    // Create audit log
    await withAudit(
      "org_settings.updated",
      currentSettings,
      updatedSettings,
      orgId,
      request
    )

    return NextResponse.json(updatedSettings)
  } catch (error: any) {
    console.error("Error updating org settings:", error)
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Failed to update organisation settings" },
      { status: error.statusCode || 500 }
    )
  }
}
