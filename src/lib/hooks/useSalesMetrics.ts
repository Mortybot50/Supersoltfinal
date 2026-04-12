import { useOrdersQuery } from "./useOrdersQuery";
import { useMemo } from "react";
import type {
  SalesMetrics,
  RefundMetrics,
  ChannelMetrics,
  PaymentMix,
} from "@/types";

interface SalesFilters {
  venueId?: string;
  startDate?: string; // ISO string
  endDate?: string; // ISO string
}

interface SalesMetricsResult {
  metrics: SalesMetrics | null;
  refunds: RefundMetrics | null;
  channelMix: ChannelMetrics[];
  paymentMix: PaymentMix[];
  orders: Array<{
    id: string;
    order_datetime: string;
    gross_amount: number;
    tax_amount: number;
    net_amount: number;
    channel: string;
    is_void: boolean;
    is_refund: boolean;
    payment_method: string | null;
  }>;
  hasData: boolean;
  isLoading: boolean;
}

export function useSalesMetrics(filters?: SalesFilters): SalesMetricsResult {
  const { venueId, startDate, endDate } = filters || {};

  const { data: rawOrders, isLoading } = useOrdersQuery(
    venueId,
    startDate,
    endDate,
  );

  return useMemo(() => {
    const orders = rawOrders || [];

    if (isLoading || orders.length === 0) {
      return {
        metrics: null,
        refunds: null,
        channelMix: [],
        paymentMix: [],
        orders,
        hasData: false,
        isLoading,
      };
    }

    const validOrders = orders.filter((o) => !o.is_void);
    const nonRefundOrders = validOrders.filter((o) => !o.is_refund);

    // Sales totals (cents) — refunds subtract
    const netSales = validOrders.reduce(
      (sum, o) => sum + (o.is_refund ? -o.net_amount : o.net_amount),
      0,
    );
    const grossSales = validOrders.reduce(
      (sum, o) => sum + (o.is_refund ? -o.gross_amount : o.gross_amount),
      0,
    );
    const totalTax = validOrders.reduce(
      (sum, o) => sum + (o.is_refund ? -o.tax_amount : o.tax_amount),
      0,
    );
    const totalOrders = nonRefundOrders.length;
    const avgCheck = totalOrders > 0 ? netSales / totalOrders : 0;

    // Refund metrics
    const refundOrders = orders.filter((o) => o.is_refund);
    const voidOrders = orders.filter((o) => o.is_void);
    const totalRefundValue = Math.abs(
      refundOrders.reduce((sum, o) => sum + o.net_amount, 0),
    );

    const refunds: RefundMetrics = {
      refund_count: refundOrders.length,
      refund_rate_percent:
        orders.length > 0 ? (refundOrders.length / orders.length) * 100 : 0,
      refund_value: totalRefundValue,
      refund_value_percent:
        netSales > 0 ? (totalRefundValue / netSales) * 100 : 0,
      void_count: voidOrders.length,
      void_rate_percent:
        orders.length > 0 ? (voidOrders.length / orders.length) * 100 : 0,
    };

    // Channel mix
    const byChannel = new Map<string, typeof validOrders>();
    validOrders.forEach((o) => {
      const arr = byChannel.get(o.channel) || [];
      arr.push(o);
      byChannel.set(o.channel, arr);
    });
    const channelMix: ChannelMetrics[] = Array.from(byChannel.entries()).map(
      ([channel, chOrders]) => {
        const chSales = chOrders.reduce(
          (sum, o) => sum + (o.is_refund ? -o.net_amount : o.net_amount),
          0,
        );
        return {
          channel,
          sales: chSales,
          orders: chOrders.length,
          avg_check: chOrders.length > 0 ? chSales / chOrders.length : 0,
          share_pct: netSales > 0 ? (chSales / netSales) * 100 : 0,
        };
      },
    );

    // Payment mix from orders.payment_method
    const byPayment = new Map<string, { amount: number; count: number }>();
    const totalPaymentAmount = validOrders.reduce(
      (sum, o) => sum + o.net_amount,
      0,
    );
    validOrders.forEach((o) => {
      const method = o.payment_method || "unknown";
      const existing = byPayment.get(method) || { amount: 0, count: 0 };
      existing.amount += o.net_amount;
      existing.count += 1;
      byPayment.set(method, existing);
    });
    const paymentMix: PaymentMix[] = Array.from(byPayment.entries()).map(
      ([method, data]) => ({
        payment_method: method,
        amount: data.amount,
        transaction_count: data.count,
        share_pct:
          totalPaymentAmount > 0 ? (data.amount / totalPaymentAmount) * 100 : 0,
        avg_transaction: data.count > 0 ? data.amount / data.count : 0,
      }),
    );

    const metrics: SalesMetrics = {
      net_sales: netSales,
      gross_sales: grossSales,
      total_tax: totalTax,
      avg_check: avgCheck,
      total_orders: totalOrders,
      total_items: 0,
      items_per_order: 0,
      variance_vs_previous: { absolute: 0, percentage: null },
      variance_vs_forecast: { absolute: 0, percentage: null },
    };

    return {
      metrics,
      refunds,
      channelMix,
      paymentMix,
      orders,
      hasData: true,
      isLoading: false,
    };
  }, [rawOrders, isLoading]);
}
