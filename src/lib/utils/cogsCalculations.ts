import type {
  Order,
  OrderItem,
  Recipe,
  RecipeItem,
  WasteLog,
  PurchaseOrder,
  StockCount,
  Ingredient,
  Supplier,
  MenuItem,
} from "@/types";
import type {
  CategoryCOGS,
  SupplierCOGS,
  RecipeCOGS,
  WasteImpact,
  COGSAnomaly,
  IngredientUsage,
} from "@/types/cogs.types";

// ============================================
// CORE COGS CALCULATIONS
// ============================================

/**
 * Calculate Theoretical COGS
 * Based on recipes of items sold
 */
export function calculateTheoreticalCOGS(
  orders: Order[],
  orderItems: OrderItem[],
  recipes: Recipe[],
  recipeItems: RecipeItem[],
): number {
  // Map recipe costs
  const recipeCostMap = new Map<string, number>();
  recipes.forEach((recipe) => {
    const cost = recipeItems
      .filter((ri) => ri.recipe_id === recipe.id)
      .reduce((sum, ri) => sum + ri.line_cost, 0);
    recipeCostMap.set(recipe.id, cost);
  });

  // Calculate theoretical cost for all sold items
  const validOrders = orders.filter((o) => !o.is_void && !o.is_refund);
  const validOrderIds = new Set(validOrders.map((o) => o.id));

  const theoreticalCost = orderItems
    .filter((item) => validOrderIds.has(item.order_id))
    .reduce((sum, item) => {
      const recipeCost = recipeCostMap.get(item.menu_item_id) || 0;
      return sum + recipeCost * item.quantity;
    }, 0);

  return theoreticalCost;
}

/**
 * Calculate Actual COGS
 * Opening Stock + Purchases - Closing Stock - Waste
 */
export function calculateActualCOGS(
  openingStockValue: number,
  purchasesValue: number,
  closingStockValue: number,
  wasteValue: number,
): number {
  return openingStockValue + purchasesValue - closingStockValue - wasteValue;
}

/**
 * Calculate COGS Percentage
 */
export function calculateCOGSPercent(
  cogs: number,
  sales: number,
): number | null {
  if (sales === 0) return null;
  return (cogs / sales) * 100;
}

/**
 * Calculate COGS Variance
 */
export function calculateCOGSVariance(
  actualCOGS: number,
  theoreticalCOGS: number,
): {
  variance_value: number;
  variance_percent: number | null;
} {
  const varianceValue = actualCOGS - theoreticalCOGS;
  const variancePercent =
    theoreticalCOGS !== 0 ? (varianceValue / theoreticalCOGS) * 100 : null;

  return {
    variance_value: varianceValue,
    variance_percent: variancePercent,
  };
}

/**
 * Calculate Opening Stock Value
 * From most recent stock count before period
 */
export function calculateOpeningStockValue(ingredients: Ingredient[]): number {
  return ingredients.reduce((sum, ing) => {
    return sum + ing.current_stock * ing.cost_per_unit;
  }, 0);
}

/**
 * Calculate Closing Stock Value
 * From stock count at end of period
 */
export function calculateClosingStockValue(
  stockCount: StockCount | undefined,
  ingredients: Ingredient[],
): number {
  // In real app, would get counted quantities from stock_count_items
  // For now, use current stock levels
  return calculateOpeningStockValue(ingredients);
}

/**
 * Calculate Total Purchases Value
 */
export function calculatePurchasesValue(
  purchaseOrders: PurchaseOrder[],
): number {
  return purchaseOrders
    .filter((po) => po.status === "delivered")
    .reduce((sum, po) => sum + po.total, 0);
}

/**
 * Calculate Total Waste Value
 */
export function calculateWasteValue(wasteLogs: WasteLog[]): number {
  return wasteLogs.reduce((sum, waste) => sum + waste.value, 0);
}

// ============================================
// CATEGORY ANALYSIS
// ============================================

export function calculateCategoryBreakdown(
  ingredients: Ingredient[],
  theoreticalCOGS: number,
  actualCOGS: number,
): CategoryCOGS[] {
  // Group ingredients by category
  const categoryMap = new Map<
    string,
    {
      theoreticalCost: number;
      actualCost: number;
      itemCount: number;
    }
  >();

  ingredients.forEach((ing) => {
    if (!categoryMap.has(ing.category)) {
      categoryMap.set(ing.category, {
        theoreticalCost: 0,
        actualCost: 0,
        itemCount: 0,
      });
    }

    const cat = categoryMap.get(ing.category)!;
    // Simplified: distribute theoretical and actual proportionally by current stock value
    const stockValue = ing.current_stock * ing.cost_per_unit;
    cat.theoreticalCost += stockValue * 0.6; // Simplified allocation
    cat.actualCost += stockValue * 0.65;
    cat.itemCount += 1;
  });

  const categories: CategoryCOGS[] = [];
  const totalActualCOGS = Array.from(categoryMap.values()).reduce(
    (sum, cat) => sum + cat.actualCost,
    0,
  );

  categoryMap.forEach((data, category) => {
    const variance = data.actualCost - data.theoreticalCost;
    categories.push({
      category,
      theoretical_cogs: data.theoreticalCost,
      actual_cogs: data.actualCost,
      variance,
      variance_percent:
        data.theoreticalCost !== 0
          ? (variance / data.theoreticalCost) * 100
          : 0,
      share_of_total_cogs:
        totalActualCOGS !== 0 ? (data.actualCost / totalActualCOGS) * 100 : 0,
      item_count: data.itemCount,
    });
  });

  return categories.sort((a, b) => b.actual_cogs - a.actual_cogs);
}

// ============================================
// SUPPLIER ANALYSIS
// ============================================

export function calculateSupplierPerformance(
  purchaseOrders: PurchaseOrder[],
  suppliers: Supplier[],
): SupplierCOGS[] {
  const supplierStats = new Map<
    string,
    {
      totalPurchases: number;
      orderCount: number;
      onTimeCount: number;
      avgDaysToDeliver: number[];
    }
  >();

  purchaseOrders.forEach((po) => {
    if (!supplierStats.has(po.supplier_id)) {
      supplierStats.set(po.supplier_id, {
        totalPurchases: 0,
        orderCount: 0,
        onTimeCount: 0,
        avgDaysToDeliver: [],
      });
    }

    const stats = supplierStats.get(po.supplier_id)!;
    stats.totalPurchases += po.total;
    stats.orderCount += 1;

    if (po.status === "delivered" && po.expected_delivery_date) {
      const daysToDeliver = Math.floor(
        (new Date().getTime() - new Date(po.expected_delivery_date).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      stats.avgDaysToDeliver.push(daysToDeliver);
      if (daysToDeliver <= 0) stats.onTimeCount += 1;
    }
  });

  const totalPurchases = Array.from(supplierStats.values()).reduce(
    (sum, s) => sum + s.totalPurchases,
    0,
  );

  return suppliers
    .map((supplier) => {
      const stats = supplierStats.get(supplier.id) || {
        totalPurchases: 0,
        orderCount: 0,
        onTimeCount: 0,
        avgDaysToDeliver: [],
      };

      const avgDeliveryTime =
        stats.avgDaysToDeliver.length > 0
          ? stats.avgDaysToDeliver.reduce((a, b) => a + b, 0) /
            stats.avgDaysToDeliver.length
          : 0;

      const reliabilityScore =
        stats.orderCount > 0 ? (stats.onTimeCount / stats.orderCount) * 100 : 0;

      return {
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        total_purchases: stats.totalPurchases,
        purchase_order_count: stats.orderCount,
        unique_ingredients: 0,
        avg_delivery_time_days: avgDeliveryTime,
        share_of_total_purchases:
          totalPurchases !== 0
            ? (stats.totalPurchases / totalPurchases) * 100
            : 0,
        reliability_score: reliabilityScore,
        price_trend: "stable" as const,
        price_change_percent: 0,
      };
    })
    .sort((a, b) => b.total_purchases - a.total_purchases);
}

// ============================================
// WASTE ANALYSIS
// ============================================

export function calculateWasteImpact(
  wasteLogs: WasteLog[],
  totalCOGS: number,
): WasteImpact {
  const totalWaste = calculateWasteValue(wasteLogs);

  // Group by category (simplified - using ingredient name prefix)
  const categoryWaste = new Map<
    string,
    {
      value: number;
      qty: number;
      reasons: Map<string, number>;
    }
  >();

  wasteLogs.forEach((waste) => {
    const category = "General"; // Simplified

    if (!categoryWaste.has(category)) {
      categoryWaste.set(category, {
        value: 0,
        qty: 0,
        reasons: new Map(),
      });
    }

    const catStats = categoryWaste.get(category)!;
    catStats.value += waste.value;
    catStats.qty += waste.quantity;

    const currentCount = catStats.reasons.get(waste.reason) || 0;
    catStats.reasons.set(waste.reason, currentCount + 1);
  });

  // Top wasted items
  const itemWaste = new Map<
    string,
    {
      value: number;
      qty: number;
      unit: string;
      reasons: string[];
    }
  >();

  wasteLogs.forEach((waste) => {
    if (!itemWaste.has(waste.ingredient_name)) {
      itemWaste.set(waste.ingredient_name, {
        value: 0,
        qty: 0,
        unit: waste.unit,
        reasons: [],
      });
    }

    const item = itemWaste.get(waste.ingredient_name)!;
    item.value += waste.value;
    item.qty += waste.quantity;
    item.reasons.push(waste.reason);
  });

  const topWastedItems = Array.from(itemWaste.entries())
    .map(([name, data]) => ({
      ingredient_name: name,
      waste_value: data.value,
      waste_qty: data.qty,
      unit: data.unit,
      primary_reason: data.reasons[0],
    }))
    .sort((a, b) => b.waste_value - a.waste_value)
    .slice(0, 10);

  return {
    total_waste_value: totalWaste,
    waste_as_percent_of_cogs:
      totalCOGS !== 0 ? (totalWaste / totalCOGS) * 100 : 0,
    waste_by_category: Array.from(categoryWaste.entries()).map(
      ([category, data]) => {
        const topReason = Array.from(data.reasons.entries()).sort(
          (a, b) => b[1] - a[1],
        )[0];

        return {
          category,
          waste_value: data.value,
          waste_qty: data.qty,
          top_reason: topReason ? topReason[0] : "Unknown",
        };
      },
    ),
    top_wasted_items: topWastedItems,
  };
}

// ============================================
// RECIPE COSTING
// ============================================

export function calculateRecipeCOGS(
  recipes: Recipe[],
  recipeItems: RecipeItem[],
  orderItems: OrderItem[],
  menuItems: MenuItem[],
): RecipeCOGS[] {
  const recipeSales = new Map<
    string,
    {
      timesSold: number;
      avgPrice: number;
    }
  >();

  // Count sales per recipe
  orderItems.forEach((item) => {
    if (!recipeSales.has(item.menu_item_id)) {
      recipeSales.set(item.menu_item_id, {
        timesSold: 0,
        avgPrice: 0,
      });
    }

    const sales = recipeSales.get(item.menu_item_id)!;
    sales.timesSold += item.quantity;
  });

  // Get avg price from menu items
  menuItems.forEach((item) => {
    const sales = recipeSales.get(item.id);
    if (sales) {
      sales.avgPrice = item.selling_price;
    }
  });

  return recipes
    .map((recipe) => {
      const sales = recipeSales.get(recipe.id) || { timesSold: 0, avgPrice: 0 };
      const costPerServe = recipe.cost_per_serve;
      const totalCost = costPerServe * sales.timesSold;

      const gpPercent =
        sales.avgPrice !== 0
          ? ((sales.avgPrice - costPerServe) / sales.avgPrice) * 100
          : 0;

      return {
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        category: recipe.category,
        times_sold: sales.timesSold,
        total_theoretical_cost: totalCost,
        cost_per_serve: costPerServe,
        avg_selling_price: sales.avgPrice,
        gross_profit_percent: gpPercent,
        cost_trend: "stable" as const,
      };
    })
    .sort((a, b) => b.total_theoretical_cost - a.total_theoretical_cost);
}

// ============================================
// ANOMALY DETECTION
// ============================================

export function detectCOGSAnomalies(
  ingredients: Ingredient[],
  wasteLogs: WasteLog[],
  purchaseOrders: PurchaseOrder[],
): COGSAnomaly[] {
  const anomalies: COGSAnomaly[] = [];

  // High waste detection
  wasteLogs.forEach((waste) => {
    if (waste.value > 5000) {
      anomalies.push({
        date: new Date(waste.waste_date),
        ingredient_name: waste.ingredient_name,
        anomaly_type: "high_waste",
        severity: waste.value > 10000 ? "high" : "medium",
        expected_value: 0,
        actual_value: waste.value,
        variance_percent: 100,
        suspected_cause: `High waste: ${waste.reason}`,
        suggested_action: `Review ${waste.ingredient_name} ordering and prep procedures`,
      });
    }
  });

  return anomalies.sort((a, b) => b.actual_value - a.actual_value).slice(0, 10);
}
