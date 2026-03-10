import { NextResponse } from "next/server";

const TEMPLATES = {
  suppliers: {
    headers: ["external_id", "name", "contact_email", "phone", "notes"],
    examples: [
      ["SUPP001", "Fresh Produce Co", "orders@freshproduce.com", "555-1234", "Primary fruit supplier"],
      ["SUPP002", "Metro Meats", "sales@metromeats.com.au", "", ""],
    ],
  },
  ingredients: {
    headers: ["external_id", "name", "uom", "pack_size", "pack_cost", "supplier_external_id"],
    examples: [
      ["ING001", "Tomatoes - Roma", "kg", "10kg", "45.50", "SUPP001"],
      ["ING002", "Beef Mince Premium", "kg", "5kg", "82.00", "SUPP002"],
      ["ING003", "Salt - Sea Salt", "g", "1kg", "3.50", ""],
    ],
  },
  menu: {
    headers: ["external_id", "name", "price", "category", "recipe_json"],
    examples: [
      ["MENU001", "Classic Burger", "18.90", "Mains", '[{"ingredient_external_id":"ING002","qty":0.18,"uom":"kg"},{"ingredient_external_id":"ING001","qty":0.05,"uom":"kg"}]'],
      ["MENU002", "Garden Salad", "12.50", "Salads", ""],
      ["MENU003", "Combo Meal", "24.90", "Combos", '[{"menu_item_external_id":"MENU001","qty":1},{"menu_item_external_id":"CHIPS001","qty":1}]'],
    ],
  },
  staff: {
    headers: ["external_id", "name", "email", "phone", "role", "hourly_rate"],
    examples: [
      ["STAFF001", "Sarah Johnson", "sarah.j@example.com", "555-0101", "Head Chef", "32.50"],
      ["STAFF002", "Mike Chen", "mike.c@example.com", "555-0102", "Server", "24.75"],
    ],
  },
  sales: {
    headers: ["date", "menu_item_external_id", "qty", "revenue"],
    examples: [
      ["2025-01-15", "MENU001", "42", "793.80"],
      ["2025-01-15", "MENU002", "28", "350.00"],
      ["2025-01-16", "MENU001", "38", "718.20"],
    ],
  },
  stock: {
    headers: ["ingredient_external_id", "on_hand_qty", "uom"],
    examples: [
      ["ING001", "25", "kg"],
      ["ING002", "12.5", "kg"],
      ["ING003", "800", "g"],
    ],
  },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (!type || !(type in TEMPLATES)) {
    return NextResponse.json(
      { error: "Invalid type. Must be one of: suppliers, ingredients, menu, staff, sales, stock" },
      { status: 400 }
    );
  }

  const template = TEMPLATES[type as keyof typeof TEMPLATES];

  // Generate CSV content
  const csvLines = [
    template.headers.join(","),
    ...template.examples.map((row) =>
      row.map((cell) => {
        // Escape cells containing commas or quotes
        if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(",")
    ),
  ];

  const csvContent = csvLines.join("\n");
  const filename = `${type}_template.csv`;

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
