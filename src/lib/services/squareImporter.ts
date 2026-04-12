import { supabase } from "@/integrations/supabase/client";
import type { ImportProgress } from "@/lib/types/onboarding";

class SquareImporter {
  async importAll(orgId: string, accessToken: string): Promise<ImportProgress> {
    const progress: ImportProgress = {
      catalog: { status: "pending" },
      team: { status: "pending" },
      sales: { status: "pending" },
      venue: { status: "pending" },
    };

    try {
      // Import catalog (menu items)
      progress.catalog!.status = "importing";
      const catalogResult = await this.importCatalog(orgId, accessToken);
      progress.catalog = { status: "complete", count: catalogResult.count };
    } catch (error) {
      progress.catalog = { status: "error", error: error.message };
    }

    try {
      // Import team members
      progress.team!.status = "importing";
      const teamResult = await this.importTeam(orgId, accessToken);
      progress.team = { status: "complete", count: teamResult.count };
    } catch (error) {
      progress.team = { status: "error", error: error.message };
    }

    try {
      // Import sales history
      progress.sales!.status = "importing";
      const salesResult = await this.importSalesHistory(orgId, accessToken);
      progress.sales = { status: "complete", count: salesResult.count };
    } catch (error) {
      progress.sales = { status: "error", error: error.message };
    }

    try {
      // Import venue details
      progress.venue!.status = "importing";
      await this.importVenueDetails(orgId, accessToken);
      progress.venue = { status: "complete" };
    } catch (error) {
      progress.venue = { status: "error", error: error.message };
    }

    return progress;
  }

  private async importCatalog(
    orgId: string,
    accessToken: string,
  ): Promise<{ count: number }> {
    // Call Square Catalog API
    const response = await fetch("/api/square/catalog/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const data = await response.json();

    // Transform and insert menu items
    const menuItems = data.objects?.filter((obj) => obj.type === "ITEM") || [];

    for (const item of menuItems) {
      await supabase.from("menu_items").insert({
        org_id: orgId,
        name: item.item_data.name,
        category: item.item_data.category_id || "Uncategorized",
        price:
          Number(
            item.item_data.variations?.[0]?.item_variation_data?.price_money
              ?.amount || 0,
          ) / 100,
        created_by: supabase.auth.user()?.id,
        external_id: item.id,
        metadata: { square_data: item },
      });
    }

    return { count: menuItems.length };
  }

  private async importTeam(
    orgId: string,
    accessToken: string,
  ): Promise<{ count: number }> {
    // Call Square Team API
    const response = await fetch("/api/square/team/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const data = await response.json();

    // Get first venue for this org
    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("org_id", orgId)
      .limit(1)
      .single();

    const teamMembers = data.team_members || [];

    for (const member of teamMembers) {
      await supabase.from("staff").insert({
        org_id: orgId,
        venue_id: venue?.id,
        first_name: member.given_name || "Unknown",
        last_name: member.family_name || "Staff",
        email: member.email_address,
        mobile_phone: member.phone_number,
        role: "crew",
        employment_type: member.status === "ACTIVE" ? "casual" : "inactive",
        external_id: member.id,
        metadata: { square_data: member },
      });
    }

    return { count: teamMembers.length };
  }

  private async importSalesHistory(
    orgId: string,
    accessToken: string,
  ): Promise<{ count: number }> {
    // Get sales for last 90 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const response = await fetch("/api/square/orders/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      }),
    });

    const data = await response.json();

    // Get first venue
    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("org_id", orgId)
      .limit(1)
      .single();

    const orders = data.orders || [];
    let salesCount = 0;

    // Aggregate by day
    const salesByDay = {};

    for (const order of orders) {
      if (order.state !== "COMPLETED") continue;

      const date = new Date(order.created_at).toISOString().split("T")[0];
      const amount = Number(order.total_money?.amount || 0) / 100;

      if (!salesByDay[date]) {
        salesByDay[date] = { total: 0, count: 0 };
      }

      salesByDay[date].total += amount;
      salesByDay[date].count += 1;
    }

    // Insert aggregated sales
    for (const [date, data] of Object.entries(salesByDay)) {
      await supabase.from("sales").insert({
        org_id: orgId,
        venue_id: venue?.id,
        sale_date: date,
        amount: data.total,
        payment_method: "card", // Square is primarily card payments
        metadata: { transaction_count: data.count, source: "square_import" },
      });
      salesCount++;
    }

    return { count: salesCount };
  }

  private async importVenueDetails(
    orgId: string,
    accessToken: string,
  ): Promise<void> {
    // Call Square Locations API
    const response = await fetch("/api/square/locations/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken }),
    });

    const data = await response.json();
    const location = data.locations?.[0];

    if (location) {
      // Update venue with Square data
      const { data: venue } = await supabase
        .from("venues")
        .select("id")
        .eq("org_id", orgId)
        .limit(1)
        .single();

      if (venue) {
        await supabase
          .from("venues")
          .update({
            address: location.address?.address_line_1,
            suburb: location.address?.locality,
            state: location.address?.administrative_district_level_1,
            postcode: location.address?.postal_code,
            phone: location.phone_number,
            metadata: {
              square_location_id: location.id,
              timezone: location.timezone,
              business_hours: location.business_hours,
            },
          })
          .eq("id", venue.id);
      }
    }
  }
}

export const squareImporter = new SquareImporter();
