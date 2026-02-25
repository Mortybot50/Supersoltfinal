import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

/**
 * Shared orders query — all hooks that need orders for a venue/date range
 * should use this to share the React Query cache.
 */
export function useOrdersQuery(venueId?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['orders', venueId, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('id, order_datetime, channel, gross_amount, tax_amount, net_amount, is_void, is_refund, refund_reason, payment_method')
      if (venueId) query = query.eq('venue_id', venueId)
      if (startDate) query = query.gte('order_datetime', startDate)
      if (endDate) query = query.lte('order_datetime', endDate)
      const { data, error } = await query.order('order_datetime')
      if (error) throw error
      return data || []
    },
    enabled: !!venueId,
  })
}
