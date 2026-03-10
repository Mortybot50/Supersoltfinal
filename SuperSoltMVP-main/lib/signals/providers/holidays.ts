import { db } from "@/db";
import { holidays } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { format } from "date-fns";
import type { SignalProvider, SignalContext } from "../types";

// Simple rule: public holiday bump +15%
const HOLIDAY_BUMP = 1.15;

export const holidaysProvider: SignalProvider = {
  async getMultiplier({ venueId, at }: SignalContext) {
    // Format as YYYY-MM-DD for date column comparison
    const dateStr = format(at, "yyyy-MM-dd");
    
    const row = await db.query.holidays.findFirst({
      where: (t, { and, eq }) => and(
        eq(t.venueId, venueId), 
        eq(t.date, dateStr)
      )
    });
    
    return row ? HOLIDAY_BUMP : 1.0;
  }
};
