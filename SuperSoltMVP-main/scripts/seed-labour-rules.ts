import { db } from "../db";
import { labourRules, venues } from "../db/schema";
import { eq } from "drizzle-orm";

async function seedLabourRules() {
  // Get all venues
  const allVenues = await db.select().from(venues);
  
  console.log(`Found ${allVenues.length} venues`);

  for (const venue of allVenues) {
    console.log(`Seeding labour rules for venue: ${venue.name} (${venue.id})`);
    
    // Check if rules already exist
    const existing = await db
      .select()
      .from(labourRules)
      .where(eq(labourRules.venueId, venue.id));
    
    if (existing.length > 0) {
      console.log(`  Skipping - ${existing.length} rules already exist`);
      continue;
    }

    // Default rules for FOH (Front of House)
    const fohRule = {
      orgId: venue.orgId,
      venueId: venue.id,
      role: "FOH",
      metric: "orders" as const,
      perStaffPerHour: "12.00", // 1 staff per 12 orders per hour
      minShiftMinutes: 180, // 3 hours minimum
      maxShiftMinutes: 480, // 8 hours maximum
      openHour: 10 as const, // 10 AM
      closeHour: 22 as const, // 10 PM
      daysMask: 127 as const, // All days (binary: 1111111)
    };
    await db.insert(labourRules).values(fohRule);

    // Default rules for BOH (Back of House)
    const bohRule = {
      orgId: venue.orgId,
      venueId: venue.id,
      role: "BOH",
      metric: "orders" as const,
      perStaffPerHour: "15.00", // 1 staff per 15 orders per hour
      minShiftMinutes: 240, // 4 hours minimum
      maxShiftMinutes: 480, // 8 hours maximum
      openHour: 9 as const, // 9 AM (prep starts earlier)
      closeHour: 23 as const, // 11 PM (cleanup after close)
      daysMask: 127 as const, // All days
    };
    await db.insert(labourRules).values(bohRule);

    // Default rules for Bar
    const barRule = {
      orgId: venue.orgId,
      venueId: venue.id,
      role: "Bar",
      metric: "revenue" as const,
      perStaffPerHour: "500.00", // 1 staff per $500 revenue per hour
      minShiftMinutes: 240, // 4 hours minimum
      maxShiftMinutes: 480, // 8 hours maximum
      openHour: 11 as const, // 11 AM
      closeHour: 23 as const, // 11 PM
      daysMask: 127 as const, // All days
    };
    await db.insert(labourRules).values(barRule);

    console.log(`  Created 3 default labour rules (FOH, BOH, Bar)`);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seedLabourRules().catch((error) => {
  console.error("Error seeding labour rules:", error);
  process.exit(1);
});
