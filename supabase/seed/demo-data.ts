import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export interface SeedResult {
  orgId: string;
  venueIds: string[];
  staffIds: string[];
  ingredientIds: string[];
  supplierIds: string[];
}

// Australian demo data
const DEMO_ORG = {
  name: "Bella Vista Restaurant Group",
  abn: "51234567890",
  business_address: "123 Collins Street",
  business_suburb: "Melbourne",
  business_state: "VIC",
  business_postcode: "3000",
  business_phone: "0390001234",
  business_email: "admin@bellavista-demo.com.au",
};

const DEMO_VENUES = [
  {
    name: "Bella Vista CBD",
    venue_type: "restaurant" as const,
    address: "123 Collins Street",
    suburb: "Melbourne",
    state: "VIC",
    postcode: "3000",
    phone: "0390001234",
  },
  {
    name: "Bella Vista Docklands",
    venue_type: "cafe" as const,
    address: "45 Harbour Esplanade",
    suburb: "Docklands",
    state: "VIC",
    postcode: "3008",
    phone: "0390005678",
  },
];

const DEMO_STAFF = [
  {
    first_name: "Sarah",
    last_name: "Chen",
    email: "sarah.chen@demo.com",
    mobile_phone: "+61412345678",
    role: "manager",
    employment_type: "full_time",
    base_hourly_rate: 45,
    tfn: "123456789",
  },
  {
    first_name: "Marcus",
    last_name: "Williams",
    email: "marcus.w@demo.com",
    mobile_phone: "+61423456789",
    role: "chef",
    employment_type: "full_time",
    base_hourly_rate: 38,
    tfn: "234567890",
  },
  {
    first_name: "Emma",
    last_name: "Thompson",
    email: "emma.t@demo.com",
    mobile_phone: "+61434567890",
    role: "supervisor",
    employment_type: "full_time",
    base_hourly_rate: 32,
    tfn: "345678901",
  },
  {
    first_name: "James",
    last_name: "Nguyen",
    email: "james.n@demo.com",
    mobile_phone: "+61445678901",
    role: "crew",
    employment_type: "casual",
    base_hourly_rate: 28.5,
    tfn: "456789012",
  },
  {
    first_name: "Olivia",
    last_name: "Brown",
    email: "olivia.b@demo.com",
    mobile_phone: "+61456789012",
    role: "crew",
    employment_type: "part_time",
    base_hourly_rate: 26.5,
    tfn: "567890123",
  },
];

const DEMO_SUPPLIERS = [
  {
    name: "Melbourne Fresh Produce",
    contact_name: "Tony Russo",
    contact_email: "orders@melbfresh.com.au",
    contact_phone: "0390123456",
  },
  {
    name: "Victorian Meats Co",
    contact_name: "Lisa Chang",
    contact_email: "lisa@vicmeats.com.au",
    contact_phone: "0398765432",
  },
  {
    name: "Coastal Seafood Suppliers",
    contact_name: "Steve Murphy",
    contact_email: "steve@coastalseafood.com.au",
    contact_phone: "0395551234",
  },
];

const DEMO_INGREDIENTS = [
  // Proteins
  { name: "Beef Mince", unit: "kg", category: "Proteins", current_price: 12.5 },
  {
    name: "Chicken Breast",
    unit: "kg",
    category: "Proteins",
    current_price: 15.0,
  },
  {
    name: "Salmon Fillet",
    unit: "kg",
    category: "Proteins",
    current_price: 38.0,
  },
  { name: "Prawns", unit: "kg", category: "Proteins", current_price: 42.0 },

  // Produce
  { name: "Tomatoes", unit: "kg", category: "Produce", current_price: 5.5 },
  { name: "Lettuce", unit: "each", category: "Produce", current_price: 3.2 },
  { name: "Onions", unit: "kg", category: "Produce", current_price: 2.8 },
  { name: "Mushrooms", unit: "kg", category: "Produce", current_price: 12.0 },

  // Dairy
  { name: "Mozzarella", unit: "kg", category: "Dairy", current_price: 18.5 },
  { name: "Parmesan", unit: "kg", category: "Dairy", current_price: 32.0 },
  { name: "Cream", unit: "L", category: "Dairy", current_price: 8.5 },
  { name: "Butter", unit: "kg", category: "Dairy", current_price: 16.0 },

  // Dry Goods
  { name: "Pasta", unit: "kg", category: "Dry Goods", current_price: 4.5 },
  { name: "Rice", unit: "kg", category: "Dry Goods", current_price: 3.8 },
  { name: "Flour", unit: "kg", category: "Dry Goods", current_price: 2.2 },
  { name: "Olive Oil", unit: "L", category: "Dry Goods", current_price: 18.0 },
];

const DEMO_MENU_ITEMS = [
  { name: "Margherita Pizza", category: "Pizza", price: 22.0 },
  { name: "Pepperoni Pizza", category: "Pizza", price: 26.0 },
  { name: "Spaghetti Bolognese", category: "Pasta", price: 24.0 },
  { name: "Fettuccine Carbonara", category: "Pasta", price: 26.0 },
  { name: "Grilled Salmon", category: "Mains", price: 38.0 },
  { name: "Chicken Parmigiana", category: "Mains", price: 32.0 },
  { name: "Caesar Salad", category: "Salads", price: 18.0 },
  { name: "Greek Salad", category: "Salads", price: 16.0 },
  { name: "Tiramisu", category: "Desserts", price: 14.0 },
  { name: "Panna Cotta", category: "Desserts", price: 12.0 },
];

export async function seedDemoData(
  supabase: Client,
  userId: string,
): Promise<SeedResult> {
  try {
    // 1. Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        ...DEMO_ORG,
        created_by: userId,
        settings: { demo_mode: true, onboarding_completed: true },
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // 2. Add user as owner
    await supabase.from("org_members").insert({
      org_id: org.id,
      user_id: userId,
      role: "owner",
      is_active: true,
      joined_at: new Date().toISOString(),
    });

    // 3. Create venues
    const venueIds: string[] = [];
    for (const venue of DEMO_VENUES) {
      const { data, error } = await supabase
        .from("venues")
        .insert({
          ...venue,
          org_id: org.id,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      venueIds.push(data.id);

      // Give user access to venue
      const { data: orgMember } = await supabase
        .from("org_members")
        .select("id")
        .eq("org_id", org.id)
        .eq("user_id", userId)
        .single();

      if (orgMember) {
        await supabase.from("venue_access").insert({
          org_member_id: orgMember.id,
          venue_id: data.id,
        });
      }
    }

    // 4. Create staff members
    const staffIds: string[] = [];
    for (const staff of DEMO_STAFF) {
      const { data, error } = await supabase
        .from("staff")
        .insert({
          ...staff,
          org_id: org.id,
          venue_id: venueIds[0], // Assign to first venue
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      staffIds.push(data.id);
    }

    // 5. Create suppliers
    const supplierIds: string[] = [];
    for (const supplier of DEMO_SUPPLIERS) {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          ...supplier,
          org_id: org.id,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      supplierIds.push(data.id);
    }

    // 6. Create ingredients
    const ingredientIds: string[] = [];
    for (const ingredient of DEMO_INGREDIENTS) {
      const { data, error } = await supabase
        .from("ingredients")
        .insert({
          ...ingredient,
          org_id: org.id,
          supplier_id:
            supplierIds[Math.floor(Math.random() * supplierIds.length)],
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      ingredientIds.push(data.id);
    }

    // 7. Create menu items
    for (const item of DEMO_MENU_ITEMS) {
      await supabase.from("menu_items").insert({
        ...item,
        org_id: org.id,
        created_by: userId,
      });
    }

    // 8. Generate sample sales data for last 30 days
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate 50-150 transactions per day
      const transactionCount = Math.floor(Math.random() * 100) + 50;
      let dailyTotal = 0;

      for (let j = 0; j < transactionCount; j++) {
        const amount = Math.floor(Math.random() * 80) + 20; // $20-$100 per transaction
        dailyTotal += amount;

        await supabase.from("sales").insert({
          org_id: org.id,
          venue_id: venueIds[0],
          sale_date: date.toISOString().split("T")[0],
          payment_method: Math.random() > 0.3 ? "card" : "cash",
          amount,
          created_at: date.toISOString(),
        });
      }
    }

    return {
      orgId: org.id,
      venueIds,
      staffIds,
      ingredientIds,
      supplierIds,
    };
  } catch (error) {
    console.error("Seed error:", error);
    throw error;
  }
}
