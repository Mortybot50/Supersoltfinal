import type * as Types from "@/types";

/**
 * Calculate net sales from orders (excluding voids, handling refunds)
 */
export function calculateNetSales(orders: Types.Order[]): number {
  return orders
    .filter((o) => !o.is_void)
    .reduce((sum, order) => {
      const net = order.net_amount;
      return sum + (order.is_refund ? -net : net);
    }, 0);
}

/**
 * Calculate average check value
 */
export function calculateAverageCheck(orders: Types.Order[]): number {
  const validOrders = orders.filter((o) => !o.is_void);
  if (validOrders.length === 0) return 0;

  const totalSales = calculateNetSales(orders);
  return totalSales / validOrders.length;
}

/**
 * Calculate variance between two values
 */
export function calculateVariance(
  actual: number,
  comparison: number,
): { absolute: number; percentage: number | null } {
  return {
    absolute: actual - comparison,
    percentage:
      comparison !== 0 ? ((actual - comparison) / comparison) * 100 : null,
  };
}

/**
 * Calculate pacing against target
 */
export function calculatePacing(
  actualToDate: number,
  targetToDate: number,
  daysElapsed: number,
  totalDays: number,
): Types.PacingMetrics {
  if (daysElapsed === 0) {
    return {
      actual_to_date: actualToDate,
      target_to_date: targetToDate,
      pacing_percent: 0,
      projected_finish: 0,
      target_total: targetToDate,
      on_track: false,
    };
  }

  const runRate = actualToDate / daysElapsed;
  const projected = runRate * totalDays;
  const pacing = targetToDate !== 0 ? actualToDate / targetToDate : 0;

  return {
    actual_to_date: actualToDate,
    target_to_date: targetToDate,
    pacing_percent: pacing * 100,
    projected_finish: projected,
    target_total: (targetToDate / daysElapsed) * totalDays,
    on_track: pacing >= 0.95,
  };
}

/**
 * Calculate refund metrics
 */
export function calculateRefundMetrics(
  orders: Types.Order[],
): Types.RefundMetrics {
  const totalOrders = orders.length;
  const refunds = orders.filter((o) => o.is_refund);
  const voids = orders.filter((o) => o.is_void);
  const validOrders = orders.filter((o) => !o.is_void && !o.is_refund);

  const totalSales = calculateNetSales(validOrders);
  const totalRefundValue = Math.abs(
    refunds.reduce((sum, o) => sum + o.net_amount, 0),
  );

  return {
    refund_count: refunds.length,
    refund_rate_percent:
      totalOrders > 0 ? (refunds.length / totalOrders) * 100 : 0,
    refund_value: totalRefundValue,
    refund_value_percent:
      totalSales > 0 ? (totalRefundValue / totalSales) * 100 : 0,
    void_count: voids.length,
    void_rate_percent: totalOrders > 0 ? (voids.length / totalOrders) * 100 : 0,
  };
}

/**
 * Calculate channel mix
 */
export function calculateChannelMix(
  orders: Types.Order[],
): Types.ChannelMetrics[] {
  const validOrders = orders.filter((o) => !o.is_void);
  const totalSales = calculateNetSales(validOrders);

  const byChannel = validOrders.reduce(
    (acc, order) => {
      if (!acc[order.channel]) {
        acc[order.channel] = [];
      }
      acc[order.channel].push(order);
      return acc;
    },
    {} as Record<string, Types.Order[]>,
  );

  return Object.entries(byChannel).map(([channel, channelOrders]) => {
    const channelSales = calculateNetSales(channelOrders);
    return {
      channel,
      sales: channelSales,
      orders: channelOrders.length,
      avg_check: channelSales / channelOrders.length,
      share_pct: totalSales > 0 ? (channelSales / totalSales) * 100 : 0,
    };
  });
}

/**
 * Calculate payment mix
 */
export function calculatePaymentMix(
  tenders: Types.Tender[],
): Types.PaymentMix[] {
  const totalAmount = tenders.reduce((sum, t) => sum + t.amount, 0);

  const byMethod = tenders.reduce(
    (acc, tender) => {
      if (!acc[tender.payment_method]) {
        acc[tender.payment_method] = [];
      }
      acc[tender.payment_method].push(tender);
      return acc;
    },
    {} as Record<string, Types.Tender[]>,
  );

  return Object.entries(byMethod).map(([method, methodTenders]) => {
    const methodAmount = methodTenders.reduce((sum, t) => sum + t.amount, 0);
    return {
      payment_method: method,
      amount: methodAmount,
      transaction_count: methodTenders.length,
      share_pct: totalAmount > 0 ? (methodAmount / totalAmount) * 100 : 0,
      avg_transaction: methodAmount / methodTenders.length,
    };
  });
}

// ============================================
// LABOUR CALCULATIONS
// ============================================

export function calculateTotalLabourHours(
  timesheets: Types.Timesheet[],
): number {
  return timesheets
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.total_hours, 0);
}

export function calculateTotalLabourCost(
  timesheets: Types.Timesheet[],
): number {
  return timesheets
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + t.gross_pay, 0);
}

export function calculateLabourPercent(
  labourCost: number,
  sales: number,
): number | null {
  if (sales === 0) return null;
  return (labourCost / sales) * 100;
}

export function calculateShiftCost(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  hourlyRate: number,
): { hours: number; cost: number } {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);

  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const workedMinutes = totalMinutes - breakMinutes;
  const workedHours = workedMinutes / 60;

  return {
    hours: workedHours,
    cost: Math.round(workedHours * hourlyRate),
  };
}

// ============================================
// INVENTORY CALCULATIONS
// ============================================

export function calculateTotalStockValue(
  ingredients: Types.Ingredient[],
): number {
  return ingredients
    .filter((ing) => ing.active)
    .reduce((sum, ing) => sum + ing.current_stock * ing.cost_per_unit, 0);
}

export function calculateItemsBelowPar(
  ingredients: Types.Ingredient[],
): number {
  return ingredients.filter(
    (ing) => ing.active && ing.current_stock < ing.par_level,
  ).length;
}

export function calculateItemsToOrder(ingredients: Types.Ingredient[]): number {
  return ingredients.filter(
    (ing) => ing.active && ing.current_stock < ing.par_level,
  ).length;
}

export function calculateTotalWasteValue(
  wasteLogs: Types.WasteEntry[],
): number {
  return wasteLogs.reduce((sum, log) => sum + log.value, 0);
}

export function calculateStockVariance(
  stockCounts: Types.StockCountItem[],
): number {
  return stockCounts.reduce((sum, item) => sum + item.variance_value, 0);
}

// ============================================
// RECIPE CALCULATIONS
// ============================================

export function calculateRecipeCost(items: Types.RecipeIngredient[]): number {
  return items.reduce((sum, item) => sum + item.line_cost, 0);
}

export function calculateGPPercent(
  sellingPrice: number,
  cost: number,
): number | null {
  if (sellingPrice === 0) return null;
  return ((sellingPrice - cost) / sellingPrice) * 100;
}

export function calculateMarkup(
  sellingPrice: number,
  cost: number,
): number | null {
  if (cost === 0) return null;
  return ((sellingPrice - cost) / cost) * 100;
}

// ============================================
// COGS CALCULATIONS
// ============================================

export function calculateTheoreticalCOGS(
  orderItems: Types.OrderItem[],
  menuItems: Types.MenuItem[],
): number {
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m.cost_price || 0]));

  return orderItems.reduce((sum, item) => {
    const recipeCost = menuItemMap.get(item.menu_item_id) || 0;
    return sum + recipeCost * item.quantity;
  }, 0);
}

export function calculateActualCOGS(
  openingStock: number,
  purchases: number,
  closingStock: number,
  waste: number,
): number {
  return openingStock + purchases - closingStock - waste;
}

export function calculateCOGSPercent(
  cogs: number,
  sales: number,
): number | null {
  if (sales === 0) return null;
  return (cogs / sales) * 100;
}

// ============================================
// CASH FLOW CALCULATIONS
// ============================================

export function calculateCashRunway(
  currentBalance: number,
  avgDailyBurn: number,
): number {
  if (avgDailyBurn === 0 || avgDailyBurn < 0) return 999;
  return Math.floor(currentBalance / avgDailyBurn);
}

export function calculateUpcomingObligations(
  obligations: Types.CashFlowObligation[],
  days: number,
): number {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return obligations
    .filter(
      (o) => o.status === "upcoming" && new Date(o.due_date) <= futureDate,
    )
    .reduce((sum, o) => sum + o.amount, 0);
}
