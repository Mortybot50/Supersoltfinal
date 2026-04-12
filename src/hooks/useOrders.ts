/**
 * Shared hook for querying orders from Supabase.
 * Works for both Square-synced and manually imported orders.
 *
 * Usage:
 *   const { orders, isLoading, error, refetch } = useOrders({
 *     venueId: currentVenue?.id,
 *     startDate: '2026-02-01T00:00:00Z',
 *     endDate:   '2026-02-28T23:59:59Z',
 *   })
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderRow {
  id: string;
  venue_id: string;
  order_number: string;
  order_datetime: string;
  channel: string;
  gross_amount: number;
  tax_amount: number;
  net_amount: number;
  discount_amount: number;
  tip_amount: number;
  service_charge: number;
  is_void: boolean;
  is_refund: boolean;
  refund_reason: string | null;
  payment_method: string | null;
  source: string | null;
  external_id: string | null;
  customer_name: string | null;
  staff_member: string | null;
  notes: string | null;
}

export interface UseOrdersFilters {
  venueId?: string;
  startDate?: string; // ISO string
  endDate?: string; // ISO string
  channel?: string; // e.g. 'dine-in', 'takeaway'
  source?: string; // e.g. 'square', 'csv'
  includeVoids?: boolean; // default false
}

export function useOrders(filters?: UseOrdersFilters) {
  const {
    venueId,
    startDate,
    endDate,
    channel,
    source,
    includeVoids = false,
  } = filters || {};

  return useQuery({
    queryKey: [
      "orders",
      venueId,
      startDate,
      endDate,
      channel,
      source,
      includeVoids,
    ],
    queryFn: async (): Promise<OrderRow[]> => {
      let query = supabase
        .from("orders")
        .select(
          "id, venue_id, order_number, order_datetime, channel, gross_amount, tax_amount, net_amount, discount_amount, tip_amount, service_charge, is_void, is_refund, refund_reason, payment_method, source, external_id, customer_name, staff_member, notes",
        );

      if (venueId) query = query.eq("venue_id", venueId);
      if (startDate) query = query.gte("order_datetime", startDate);
      if (endDate) query = query.lte("order_datetime", endDate);
      if (channel) query = query.eq("channel", channel);
      if (source) query = query.eq("source", source);
      if (!includeVoids) query = query.eq("is_void", false);

      query = query.order("order_datetime", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as OrderRow[];
    },
    enabled: !!venueId,
  });
}
