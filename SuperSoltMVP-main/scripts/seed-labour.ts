import { db } from "../db"
import { staff, rosters, shifts } from "../db/schema"

const orgAId = "10000000-0000-0000-0000-000000000001" // Demo Bistro
const venueA1Id = "20000000-0000-0000-0000-000000000001" // CBD

async function seedLabour() {
  console.log("Seeding labour data...")

  // Insert 3 staff members for Demo Bistro CBD
  const staffMembers = await db
    .insert(staff)
    .values([
      {
        orgId: orgAId,
        venueId: venueA1Id,
        name: "Carla",
        email: "carla@demobistro.com",
        roleTitle: "FOH",
        hourlyRateCents: 2800,
      },
      {
        orgId: orgAId,
        venueId: venueA1Id,
        name: "Mick",
        email: "mick@demobistro.com",
        roleTitle: "Bar",
        hourlyRateCents: 2800,
      },
      {
        orgId: orgAId,
        venueId: venueA1Id,
        name: "Jo",
        email: "jo@demobistro.com",
        roleTitle: "Kitchen",
        hourlyRateCents: 2800,
      },
    ])
    .returning()

  console.log(`Inserted ${staffMembers.length} staff members`)

  // Get the Monday of the current week
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // If Sunday, go back 6 days
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)

  // Format as YYYY-MM-DD for date column
  const weekStartDate = monday.toISOString().split("T")[0]

  // Create a roster for the current week
  const [roster] = await db
    .insert(rosters)
    .values({
      orgId: orgAId,
      venueId: venueA1Id,
      weekStartDate: weekStartDate,
    })
    .returning()

  console.log(`Created roster for week starting ${weekStartDate}`)

  // Create 2 example shifts
  // Shift 1: Carla on Monday 10:00-18:00
  const mondayStart = new Date(monday)
  mondayStart.setHours(10, 0, 0, 0)
  const mondayEnd = new Date(monday)
  mondayEnd.setHours(18, 0, 0, 0)

  // Shift 2: Mick on Tuesday 16:00-23:00
  const tuesday = new Date(monday)
  tuesday.setDate(monday.getDate() + 1)
  const tuesdayStart = new Date(tuesday)
  tuesdayStart.setHours(16, 0, 0, 0)
  const tuesdayEnd = new Date(tuesday)
  tuesdayEnd.setHours(23, 0, 0, 0)

  const createdShifts = await db
    .insert(shifts)
    .values([
      {
        rosterId: roster.id,
        staffId: staffMembers[0].id, // Carla
        roleTitle: "FOH",
        startTs: mondayStart,
        endTs: mondayEnd,
        breakMinutes: 30,
      },
      {
        rosterId: roster.id,
        staffId: staffMembers[1].id, // Mick
        roleTitle: "Bar",
        startTs: tuesdayStart,
        endTs: tuesdayEnd,
        breakMinutes: 30,
      },
    ])
    .returning()

  console.log(`Created ${createdShifts.length} example shifts`)
  console.log("Labour seeding complete!")
}

seedLabour()
  .then(() => {
    console.log("Done")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Seeding failed:", err)
    process.exit(1)
  })
