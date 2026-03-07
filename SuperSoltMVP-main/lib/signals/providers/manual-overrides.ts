import { db } from "@/db";
import { demandOverrides } from "@/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import type { SignalProvider, SignalContext } from "../types";

export const manualOverridesProvider: SignalProvider = {
  async getMultiplier({ venueId, at }: SignalContext) {
    const rows = await db.query.demandOverrides.findMany({
      where: (t, { and, eq, lte, gte }) => and(
        eq(t.venueId, venueId),
        lte(t.startsAt, at),
        gte(t.endsAt, at)
      )
    });
    // combine multiplicatively
    return rows.reduce((m, r) => m * Number(r.multiplier ?? 1), 1);
  }
};
