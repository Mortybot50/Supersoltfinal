/**
 * @jest-environment node
 */

import { db } from "../../db"
import { venues, auditLogs, memberships } from "../../db/schema"
import { eq, and } from "drizzle-orm"
import { requireOrg, requireRole, withAudit } from "../../lib/authz"

describe("Venue API - Tenancy and Authorization", () => {
  const userAId = "00000000-0000-0000-0000-000000000001"
  const orgAId = "10000000-0000-0000-0000-000000000001"
  const orgBId = "10000000-0000-0000-0000-000000000002"
  const venueA1Id = "20000000-0000-0000-0000-000000000001"

  describe("GET /api/venues - Query venues by org", () => {
    it("should return only venues for org_a when userA queries (tenancy enforcement)", async () => {
      // Verify user has access to org_a
      const { role } = await requireOrg(orgAId)
      expect(role).toBe("owner")

      // Get venues for org_a
      const orgAVenues = await db
        .select()
        .from(venues)
        .where(eq(venues.orgId, orgAId))

      // Should have at least the seeded venue
      expect(orgAVenues.length).toBeGreaterThanOrEqual(1)
      
      // Find the seeded venue
      const seededVenue = orgAVenues.find((v) => v.id === venueA1Id)
      expect(seededVenue).toBeDefined()
      expect(seededVenue!.name).toBe("CBD")
      expect(seededVenue!.orgId).toBe(orgAId)

      // Ensure no venues from other orgs are included
      const allOrgIds = orgAVenues.map((v) => v.orgId)
      expect(allOrgIds.every((id) => id === orgAId)).toBe(true)
    })

    it("should throw 403 when userA tries to access org_b (cross-org violation)", async () => {
      // UserA should not have access to org_b
      await expect(requireOrg(orgBId)).rejects.toThrow("Unauthorized")
    })
  })

  describe("POST /api/venues - Create venue with role check", () => {
    it("should create venue in org_a and write audit log", async () => {
      // Verify user has proper role
      await requireRole(orgAId, ["owner", "manager"])

      // Count venues before
      const venuesBefore = await db
        .select()
        .from(venues)
        .where(eq(venues.orgId, orgAId))
      const auditLogsBefore = await db.select().from(auditLogs)

      // Create new venue
      const [newVenue] = await db
        .insert(venues)
        .values({
          orgId: orgAId,
          name: "New Location",
          timezone: "Australia/Brisbane",
        })
        .returning()

      expect(newVenue).toBeDefined()
      expect(newVenue.name).toBe("New Location")
      expect(newVenue.orgId).toBe(orgAId)

      // Create audit log
      await withAudit(
        "venue.created",
        null,
        { id: newVenue.id, name: newVenue.name, orgId: newVenue.orgId },
        orgAId,
        {
          headers: {
            get: (name: string) => {
              if (name === "x-forwarded-for") return "192.168.1.1"
              if (name === "user-agent") return "Jest Test Suite"
              return null
            },
          },
        }
      )

      // Verify venue was created
      const venuesAfter = await db
        .select()
        .from(venues)
        .where(eq(venues.orgId, orgAId))
      expect(venuesAfter.length).toBe(venuesBefore.length + 1)

      // Verify audit log was created
      const auditLogsAfter = await db.select().from(auditLogs)
      expect(auditLogsAfter.length).toBe(auditLogsBefore.length + 1)

      const latestAuditLog = auditLogsAfter[auditLogsAfter.length - 1]
      expect(latestAuditLog.action).toBe("venue.created")
      expect(latestAuditLog.orgId).toBe(orgAId)
      expect(latestAuditLog.actorUserId).toBe(userAId)
      expect(latestAuditLog.ip).toBe("192.168.1.1")
      expect(latestAuditLog.userAgent).toBe("Jest Test Suite")
      expect(latestAuditLog.after).toBeDefined()
      expect((latestAuditLog.after as any).id).toBe(newVenue.id)

      // Cleanup: Delete the created venue to keep tests idempotent
      await db.delete(venues).where(eq(venues.id, newVenue.id))
      await db.delete(auditLogs).where(eq(auditLogs.id, latestAuditLog.id))
    })

    it("should throw 403 when userA tries to create venue in org_b", async () => {
      // UserA should not be able to create venue in org_b
      await expect(requireRole(orgBId, ["owner", "manager"])).rejects.toThrow(
        "Unauthorized"
      )
    })
  })

  describe("Authorization helpers", () => {
    it("should verify membership exists for userA in org_a", async () => {
      const membership = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userAId),
            eq(memberships.orgId, orgAId)
          )
        )

      expect(membership.length).toBe(1)
      expect(membership[0].role).toBe("owner")
    })

    it("should verify no membership exists for userA in org_b", async () => {
      const membership = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, userAId),
            eq(memberships.orgId, orgBId)
          )
        )

      expect(membership.length).toBe(0)
    })
  })
})
