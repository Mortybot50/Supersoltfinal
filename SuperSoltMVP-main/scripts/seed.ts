import { db } from "../db"
import { users, organisations, venues, memberships, invites } from "../db/schema"
import { randomUUID } from "crypto"

async function seed() {
  console.log("🌱 Seeding database...")

  // Use valid UUIDs for IDs
  const userAId = "00000000-0000-0000-0000-000000000001"
  const userBId = "00000000-0000-0000-0000-000000000002"
  const orgAId = "10000000-0000-0000-0000-000000000001"
  const orgBId = "10000000-0000-0000-0000-000000000002"
  const venueA1Id = "20000000-0000-0000-0000-000000000001"
  const venueB1Id = "20000000-0000-0000-0000-000000000002"

  // Insert users with fixed IDs
  await db.insert(users).values([
    {
      id: userAId,
      email: "a@example.com",
      name: "User A",
    },
    {
      id: userBId,
      email: "b@example.com",
      name: "User B",
    },
  ])
  console.log("✓ Created users")

  // Insert organisations
  await db.insert(organisations).values([
    {
      id: orgAId,
      name: "Demo Bistro",
      settings: {},
    },
    {
      id: orgBId,
      name: "Another Cafe",
      settings: {},
    },
  ])
  console.log("✓ Created organisations")

  // Insert venues
  await db.insert(venues).values([
    {
      id: venueA1Id,
      orgId: orgAId,
      name: "CBD",
      timezone: "Australia/Sydney",
    },
    {
      id: venueB1Id,
      orgId: orgBId,
      name: "Suburb",
      timezone: "Australia/Melbourne",
    },
  ])
  console.log("✓ Created venues")

  // Insert memberships
  await db.insert(memberships).values([
    {
      userId: userAId,
      orgId: orgAId,
      role: "owner",
    },
    {
      userId: userBId,
      orgId: orgBId,
      role: "owner",
    },
  ])
  console.log("✓ Created memberships")

  // Insert a pending invite for Demo Bistro
  const inviteExpiresAt = new Date()
  inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 14) // Expires in 14 days

  await db.insert(invites).values([
    {
      orgId: orgAId,
      email: "test-invite@example.com",
      role: "manager",
      token: randomUUID(),
      status: "pending",
      expiresAt: inviteExpiresAt,
    },
  ])
  console.log("✓ Created pending invite")

  console.log("🎉 Seeding complete!")
}

seed()
  .catch((error) => {
    console.error("❌ Seeding failed:", error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
