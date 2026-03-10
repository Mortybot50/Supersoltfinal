import { db } from "../db"
import { organisations, staff, staffIntegrations, payItemMaps } from "../db/schema"
import { eq } from "drizzle-orm"

/**
 * Seed script for payroll integration data
 * Creates StaffIntegration and PayItemMap records for Demo Bistro
 */
async function seedPayroll() {
  console.log("Starting payroll seed...")

  try {
    // Get orgId from environment or use default Demo Bistro ID
    const orgId = process.env.ORG_ID || "10000000-0000-0000-0000-000000000001"

    // Verify org exists
    const [org] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1)

    if (!org) {
      console.error(`Organization ${orgId} not found`)
      process.exit(1)
    }

    console.log(`Using organization: ${org.name} (${org.id})`)

    // Get all staff for this org
    const allStaff = await db
      .select()
      .from(staff)
      .where(eq(staff.orgId, orgId))

    if (allStaff.length === 0) {
      console.error("No staff found. Run seed-labour.ts first.")
      process.exit(1)
    }

    console.log(`Found ${allStaff.length} staff members`)

    // Create StaffIntegration records for Xero
    const staffIntegrationData = allStaff.map((s, index) => ({
      orgId,
      staffId: s.id,
      system: "xero" as const,
      externalRef: `EMP-${String(index + 1).padStart(3, "0")}`,
    }))

    console.log("Inserting staff integrations...")
    await db.insert(staffIntegrations).values(staffIntegrationData)
    console.log(`✓ Created ${staffIntegrationData.length} staff integrations`)

    // Create PayItemMap records for common role titles
    const payItemMapData = [
      { orgId, system: "xero" as const, roleTitle: "FOH", payItemCode: "BASE_FOH" },
      { orgId, system: "xero" as const, roleTitle: "Bar", payItemCode: "BASE_BAR" },
      { orgId, system: "xero" as const, roleTitle: "Kitchen", payItemCode: "BASE_KITCHEN" },
    ]

    console.log("Inserting pay item maps...")
    await db.insert(payItemMaps).values(payItemMapData)
    console.log(`✓ Created ${payItemMapData.length} pay item mappings`)

    console.log("✅ Payroll seed completed successfully!")
  } catch (error) {
    console.error("Error seeding payroll data:", error)
    throw error
  }
}

// Run the seed
seedPayroll()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exit(1)
  })
