import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { db } from "@/db"
import { venueSettings, venues } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { requireOrg, requireRole, withAudit } from "@/lib/authz"
import { z } from "zod"

// Validation schema for venue settings
const venueSettingsSchema = z.object({
  timezone: z.string().min(1).max(64).optional().nullable(),
  displayName: z.string().min(1).max(128).optional().nullable(),
  safetyStockDays: z.number().int().min(0).max(30).optional().nullable(),
  defaultOrderWindowDays: z.number().int().min(1).max(14).optional().nullable(),
})

/**
 * GET /api/settings/venue
 * Returns effective venue settings (or null if defaults)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const venueId = cookieStore.get("activeVenueId")?.value
    const orgId = cookieStore.get("activeOrgId")?.value

    if (!venueId || !orgId) {
      return NextResponse.json(
        { error: "No active venue selected" },
        { status: 400 }
      )
    }

    // Check user has access to this org
    await requireOrg(orgId)

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
        { error: "Venue not found" },
        { status: 404 }
      )
    }

    // Get venue settings (may not exist - that's ok, will use org defaults)
    const [settings] = await db
      .select()
      .from(venueSettings)
      .where(eq(venueSettings.venueId, venueId))
      .limit(1)

    return NextResponse.json(settings || {
      venueId,
      timezone: null,
      displayName: null,
      safetyStockDays: null,
      defaultOrderWindowDays: null,
    })
  } catch (error: any) {
    console.error("Error fetching venue settings:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch venue settings" },
      { status: error.statusCode || 500 }
    )
  }
}

/**
 * PATCH /api/settings/venue
 * Updates venue-specific settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const venueId = cookieStore.get("activeVenueId")?.value
    const orgId = cookieStore.get("activeOrgId")?.value

    if (!venueId || !orgId) {
      return NextResponse.json(
        { error: "No active venue selected" },
        { status: 400 }
      )
    }

    // Require owner or manager role
    await requireRole(orgId, ["owner", "manager"])

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
        { error: "Venue not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validated = venueSettingsSchema.parse(body)

    // Get current settings for audit log
    const [currentSettings] = await db
      .select()
      .from(venueSettings)
      .where(eq(venueSettings.venueId, venueId))
      .limit(1)

    // Update or insert settings
    let updatedSettings
    if (currentSettings) {
      ;[updatedSettings] = await db
        .update(venueSettings)
        .set({
          ...validated,
          updatedAt: new Date(),
        })
        .where(eq(venueSettings.venueId, venueId))
        .returning()
    } else {
      ;[updatedSettings] = await db
        .insert(venueSettings)
        .values({
          venueId,
          ...validated,
        })
        .returning()
    }

    // Create audit log
    await withAudit(
      "venue_settings.updated",
      currentSettings,
      updatedSettings,
      orgId,
      request
    )

    return NextResponse.json(updatedSettings)
  } catch (error: any) {
    console.error("Error updating venue settings:", error)
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Failed to update venue settings" },
      { status: error.statusCode || 500 }
    )
  }
}
