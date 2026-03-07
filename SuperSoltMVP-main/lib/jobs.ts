import { db } from "@/db";
import { venues, opsSuggestions } from "@/db/schema";
import { generateDailyForecast } from "@/lib/forecasting";
import { runGuardrails, type GuardrailsInput } from "@/lib/guardrails-window";
import { eq, sql, and } from "drizzle-orm";
import { format } from "date-fns";

/**
 * De-duplicate: mark previous NEW suggestions of same type+key as IGNORED
 * This prevents duplicate suggestions from accumulating on every nightly run
 */
async function deduplicateSuggestion(
  venueId: string,
  type: string,
  keyField: string,
  keyValue: string
) {
  await db.execute(sql`
    UPDATE ops_suggestions
    SET status = 'IGNORED', decided_at = NOW()
    WHERE venue_id = ${venueId}
      AND type = ${type}
      AND status = 'NEW'
      AND payload->>${keyField} = ${keyValue}
  `);
}

/**
 * Generate forecasts for a specific venue and date range
 */
export async function generateForecastsForVenue({
  venueId,
  start,
  days = 14,
}: {
  venueId: string;
  start: Date;
  days?: number;
}) {
  // Get venue to find orgId
  const [venue] = await db
    .select()
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);
  
  if (!venue) {
    throw new Error(`Venue ${venueId} not found`);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  await generateDailyForecast({
    orgId: venue.orgId,
    venueId,
    start,
    end,
  });
}

/**
 * Run nightly jobs for all venues
 * 1. Regenerate forecasts for the next N days
 * 2. Generate window-aware ops suggestions
 */
export async function runNightlyJobs({ daysAhead = 14 } = {}) {
  console.log(`[Nightly Jobs] Starting at ${new Date().toISOString()}`);
  
  // Get all venues (with limit for safety)
  const all = await db.query.venues.findMany({ limit: 500 });
  
  console.log(`[Nightly Jobs] Processing ${all.length} venues`);

  for (const v of all) {
    try {
      console.log(`[Nightly Jobs] Processing venue: ${v.name} (${v.id})`);

      // 1) Regenerate forecasts for [today .. today+daysAhead]
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      
      await generateForecastsForVenue({ 
        venueId: v.id, 
        start, 
        days: daysAhead 
      });
      
      console.log(`[Nightly Jobs] ✓ Generated forecasts for ${v.name}`);

      // 2) Generate window-aware ops suggestions for next 7 days
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      
      const guardrailsInput: GuardrailsInput = {
        orgId: v.orgId,
        venueId: v.id,
        start,
        end,
        period: "week",
      };
      
      const suggestions = await runGuardrails(guardrailsInput);
      
      // Store suggestions in database with deduplication
      if (suggestions.length > 0) {
        for (const s of suggestions) {
          // Deduplicate based on suggestion type and key payload field
          let keyField: string | null = null;
          let keyValue: string | null = null;
          
          if (s.type === "PRICE_NUDGE" && s.payload?.menuItemId) {
            keyField = "menuItemId";
            keyValue = s.payload.menuItemId;
          } else if (s.type === "ORDER_SHORTFALL" && s.payload?.ingredientId) {
            keyField = "ingredientId";
            keyValue = s.payload.ingredientId;
          } else if ((s.type === "LABOUR_TRIM" || s.type === "LABOUR_ADD") && s.payload?.role) {
            // For labour suggestions, use role + time window as key
            keyField = "role";
            keyValue = `${s.payload.role}_${s.payload.startAt || ""}_${s.payload.endAt || ""}`;
          }
          
          // Deduplicate if we have a key
          if (keyField && keyValue) {
            await deduplicateSuggestion(v.id, s.type, keyField, keyValue);
          }
          
          // Insert new suggestion
          await db.insert(opsSuggestions).values({
            orgId: v.orgId,
            venueId: v.id,
            type: s.type,
            status: "NEW",
            title: s.title,
            reason: s.reason,
            impact: s.impact || null,
            payload: s.payload,
          });
        }
      }
      
      console.log(`[Nightly Jobs] ✓ Generated ${suggestions.length} suggestions for ${v.name}`);
      
    } catch (error) {
      console.error(`[Nightly Jobs] Error processing venue ${v.name}:`, error);
      // Continue with next venue
    }
  }
  
  console.log(`[Nightly Jobs] Completed at ${new Date().toISOString()}`);
}
