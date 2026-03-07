import { requireRole } from "@/lib/authz";
import { db } from "@/db";
import { opsSuggestions, shifts, salesForecasts } from "@/db/schema";
import { sql, gte } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function UsagePage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("orgId")?.value;

  if (!orgId) {
    redirect("/dashboard");
  }

  await requireRole(orgId, ["manager", "owner"]);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Query suggestion counts by status
  const suggestionsResult = await db
    .select({
      status: opsSuggestions.status,
      count: sql<number>`count(*)::int`,
    })
    .from(opsSuggestions)
    .groupBy(opsSuggestions.status);

  // Query recent shifts count
  const shiftsResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(shifts)
    .where(gte(shifts.startTs, sevenDaysAgo));

  // Query recent forecast rows count
  const forecastsResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(salesForecasts)
    .where(gte(salesForecasts.generatedAt, sevenDaysAgo));

  const totalSuggestions = suggestionsResult.reduce((sum, row) => sum + row.count, 0);
  const shiftsCount = shiftsResult[0]?.count ?? 0;
  const forecastsCount = forecastsResult[0]?.count ?? 0;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Staging Usage (Last 7 Days)</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Suggestions</div>
          <div className="text-2xl font-semibold">{totalSuggestions}</div>
          {suggestionsResult.length > 0 && (
            <div className="mt-2 space-y-1">
              {suggestionsResult.map((row) => (
                <div key={row.status} className="text-xs text-muted-foreground">
                  {row.status}: {row.count}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Draft/Published Shifts</div>
          <div className="text-2xl font-semibold">{shiftsCount}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Forecast Rows</div>
          <div className="text-2xl font-semibold">{forecastsCount}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">No PII. For full analytics, see PostHog.</p>
    </div>
  );
}
