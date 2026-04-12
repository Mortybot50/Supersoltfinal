import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import type { InventoryMetrics } from "@/types";

interface InventoryFilters {
  venueId?: string;
  startDate?: string; // ISO string (for waste date filtering)
  endDate?: string;
}

interface InventoryMetricsResult {
  metrics: InventoryMetrics | null;
  isLoading: boolean;
}

export function useInventoryMetrics(
  filters?: InventoryFilters,
): InventoryMetricsResult {
  const { venueId, startDate, endDate } = filters || {};

  // Fetch active ingredients for stock value
  const { data: ingredients, isLoading: ingLoading } = useQuery({
    queryKey: ["inventoryIngredients", venueId],
    queryFn: async () => {
      let query = supabase
        .from("ingredients")
        .select(
          "id, current_stock, par_level, reorder_point, cost_per_unit, active",
        )
        .eq("active", true);
      if (venueId) query = query.eq("venue_id", venueId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  // Fetch waste logs for the period
  const { data: wasteLogs, isLoading: wasteLoading } = useQuery({
    queryKey: ["inventoryWaste", venueId, startDate, endDate],
    queryFn: async () => {
      let query = supabase.from("waste_logs").select("id, value, waste_date");
      if (venueId) query = query.eq("venue_id", venueId);
      if (startDate) query = query.gte("waste_date", startDate);
      if (endDate) query = query.lte("waste_date", endDate);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!venueId,
  });

  const isLoading = ingLoading || wasteLoading;

  return useMemo(() => {
    if (isLoading || !ingredients || ingredients.length === 0) {
      return { metrics: null, isLoading };
    }

    const totalStockValue = ingredients.reduce(
      (sum, ing) => sum + ing.current_stock * ing.cost_per_unit,
      0,
    );

    const itemsBelowPar = ingredients.filter(
      (ing) => ing.current_stock < ing.par_level,
    ).length;

    const itemsToOrder = ingredients.filter(
      (ing) => ing.current_stock < ing.reorder_point,
    ).length;

    const totalWasteValue = (wasteLogs || []).reduce(
      (sum, w) => sum + w.value,
      0,
    );

    return {
      metrics: {
        total_stock_value: totalStockValue,
        items_below_par: itemsBelowPar,
        items_to_order: itemsToOrder,
        total_waste_value: totalWasteValue,
        stock_turnover_days: 0,
      },
      isLoading: false,
    };
  }, [ingredients, wasteLogs, isLoading]);
}
