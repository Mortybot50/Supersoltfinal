// ============================================
// COGS DATA ENTITIES
// ============================================

export interface COGSPeriod {
  period_start: Date;
  period_end: Date;
  venue_id: string;

  // Stock positions
  opening_stock_value: number; // cents
  closing_stock_value: number; // cents

  // Purchases
  total_purchases: number; // cents
  purchase_count: number;

  // Usage
  theoretical_cogs: number; // cents (from recipes sold)
  actual_cogs: number; // cents (opening + purchases - closing - waste)

  // Waste
  total_waste_value: number; // cents
  waste_items_count: number;

  // Sales (for percentage calculation)
  total_sales: number; // cents

  // Calculated metrics
  theoretical_cogs_percent: number; // theoretical_cogs / sales * 100
  actual_cogs_percent: number; // actual_cogs / sales * 100
  variance_value: number; // actual - theoretical (cents)
  variance_percent: number; // variance / theoretical * 100
  target_cogs_percent: number; // budgeted target %
}

export interface IngredientUsage {
  ingredient_id: string;
  ingredient_name: string;
  category: string;

  // Quantities
  opening_qty: number;
  purchases_qty: number;
  waste_qty: number;
  closing_qty: number;
  theoretical_usage_qty: number; // from recipes
  actual_usage_qty: number; // opening + purchases - closing - waste

  // Values
  unit_cost: number; // cents
  opening_value: number; // cents
  purchases_value: number; // cents
  waste_value: number; // cents
  closing_value: number; // cents
  theoretical_usage_value: number; // cents
  actual_usage_value: number; // cents

  // Variance
  variance_qty: number; // actual - theoretical
  variance_value: number; // cents
  variance_percent: number; // %
}

export interface CategoryCOGS {
  category: string;
  theoretical_cogs: number; // cents
  actual_cogs: number; // cents
  variance: number; // cents
  variance_percent: number; // %
  share_of_total_cogs: number; // %
  item_count: number;
}

export interface SupplierCOGS {
  supplier_id: string;
  supplier_name: string;
  total_purchases: number; // cents
  purchase_order_count: number;
  unique_ingredients: number;
  avg_delivery_time_days: number;
  share_of_total_purchases: number; // %
  reliability_score: number; // 0-100 based on on-time delivery
  price_trend: "increasing" | "stable" | "decreasing";
  price_change_percent: number; // vs previous period
}

export interface RecipeCOGS {
  recipe_id: string;
  recipe_name: string;
  category: string;
  times_sold: number;
  total_theoretical_cost: number; // cents (sum of all times sold)
  cost_per_serve: number; // cents
  avg_selling_price: number; // cents
  gross_profit_percent: number; // (price - cost) / price * 100
  cost_trend: "up" | "stable" | "down";
}

export interface WasteImpact {
  total_waste_value: number; // cents
  waste_as_percent_of_cogs: number; // %
  waste_by_category: Array<{
    category: string;
    waste_value: number;
    waste_qty: number;
    top_reason: string;
  }>;
  top_wasted_items: Array<{
    ingredient_name: string;
    waste_value: number;
    waste_qty: number;
    unit: string;
    primary_reason: string;
  }>;
}

export interface COGSAnomaly {
  date: Date;
  ingredient_name: string;
  anomaly_type: "high_variance" | "high_waste" | "price_spike" | "usage_spike";
  severity: "high" | "medium" | "low";
  expected_value: number; // cents
  actual_value: number; // cents
  variance_percent: number;
  suspected_cause: string;
  suggested_action: string;
}

export interface COGSMetrics {
  // Summary
  theoretical_cogs: number;
  actual_cogs: number;
  variance: number;
  variance_percent: number;

  // Percentages
  theoretical_cogs_percent: number;
  actual_cogs_percent: number;
  target_cogs_percent: number;

  // Waste
  total_waste_value: number;
  waste_percent_of_cogs: number;

  // Comparison
  vs_previous_period: {
    cogs_change: number;
    cogs_percent_change: number;
  };
  vs_target: {
    variance: number;
    on_track: boolean;
  };
}
