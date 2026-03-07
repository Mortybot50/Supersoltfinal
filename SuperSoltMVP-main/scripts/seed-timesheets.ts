import { db } from "../db"
import { staff, timesheets } from "../db/schema"
import { eq, and } from "drizzle-orm"

const orgAId = "10000000-0000-0000-0000-000000000001" // Demo Bistro
const venueA1Id = "20000000-0000-0000-0000-000000000001" // CBD

async function seedTimesheets() {
  console.log("Seeding timesheet data...")

  // Find Carla's staff record
  const [carla] = await db
    .select()
    .from(staff)
    .where(
      and(
        eq(staff.orgId, orgAId),
        eq(staff.venueId, venueA1Id),
        eq(staff.name, "Carla")
      )
    )
    .limit(1)

  if (!carla) {
    console.error("Carla not found. Please run seed-labour.ts first.")
    process.exit(1)
  }

  console.log(`Found Carla: ${carla.id}`)

  // Create a timesheet for today at 09:00 UTC
  const today = new Date()
  today.setUTCHours(9, 0, 0, 0)

  const [timesheet] = await db
    .insert(timesheets)
    .values({
      orgId: orgAId,
      venueId: venueA1Id,
      staffId: carla.id,
      clockInTs: today,
      source: "pin",
      status: "pending",
      breakMinutes: 0,
    })
    .returning()

  console.log(`Created pending timesheet for Carla at ${today.toISOString()}`)
  console.log("Timesheet seeding complete!")
}

seedTimesheets()
  .then(() => {
    console.log("Done")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Seeding failed:", err)
    process.exit(1)
  })
