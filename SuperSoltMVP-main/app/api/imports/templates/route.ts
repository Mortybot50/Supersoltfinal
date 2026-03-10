export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/imports/templates?type=...
 * Return CSV templates for each import type
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (!type) {
    return NextResponse.json({ error: "type parameter required" }, { status: 400 });
  }

  let template: string;
  let filename: string;

  switch (type) {
    case "ingredients":
      filename = "ingredients_template.csv";
      template = `name,purchase_unit,preferred_supplier,supplier_sku,pack_size,pack_unit,pack_cost
Chicken Breast,g,Fresh Foods Co,CHK-001,5,kg,45.00
Cos Lettuce,each,Green Farms,LET-COS,10,each,25.00
Olive Oil,ml,Premium Oils,OIL-001,5,l,85.50`;
      break;

    case "menu_items":
      filename = "menu_items_template.csv";
      template = `name,price,tax
Caesar Salad,14.90,0.90
Grilled Chicken,18.50,1.10
Pasta Carbonara,16.00,1.00`;
      break;

    case "recipes":
      filename = "recipes_template.csv";
      template = `menu_item_name,ingredient_name,qty,unit,yield_pct,wastage_pct
Caesar Salad,Cos Lettuce,1,each,100,5
Caesar Salad,Chicken Breast,150,g,100,10
Grilled Chicken,Chicken Breast,200,g,100,8`;
      break;

    case "staff":
      filename = "staff_template.csv";
      template = `name,email,role,hourly_rate
John Smith,john@example.com,FOH,25.00
Jane Doe,jane@example.com,BOH,28.50
Mike Johnson,mike@example.com,Bar,26.75`;
      break;

    case "sales":
      filename = "sales_template.csv";
      template = `date,menu_item_name,qty,unit_price
2025-01-15,Caesar Salad,12,14.90
2025-01-15,Grilled Chicken,8,18.50
2025-01-16,Caesar Salad,15,14.90`;
      break;

    case "stock":
      filename = "stock_template.csv";
      template = `ingredient_name,qty,unit
Chicken Breast,5000,g
Cos Lettuce,20,each
Olive Oil,3000,ml`;
      break;

    default:
      return NextResponse.json({ error: "Unknown import type" }, { status: 400 });
  }

  return new NextResponse(template, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
