import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { StockCount, StockCountItem } from "@/types";

// ── Query Keys ──────────────────────────────────────────────────────

const stockCountKeys = {
  all: ["stock-counts"] as const,
  list: (venueId: string) => [...stockCountKeys.all, "list", venueId] as const,
  detail: (id: string) => [...stockCountKeys.all, "detail", id] as const,
  locations: (venueId: string) => ["inv-locations", venueId] as const,
  ingredients: (venueId: string) => ["ingredients", venueId] as const,
};

// ── Types ───────────────────────────────────────────────────────────

export interface InvLocation {
  id: string;
  name: string;
  type: string;
  code: string | null;
  display_order: number | null;
  is_active: boolean | null;
  venue_id: string;
}

export interface IngredientWithLocation {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  par_level: number;
  cost_per_unit: number;
  product_code: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  active: boolean;
  venue_id: string;
  pack_to_base_factor: number | null;
  base_unit: string | null;
  pack_size_text: string | null;
}

// ── Fetch stock counts with items ───────────────────────────────────

export function useStockCountsList() {
  const { currentVenue } = useAuth();
  const venueId = currentVenue?.id ?? "";

  return useQuery({
    queryKey: stockCountKeys.list(venueId),
    queryFn: async () => {
      if (!venueId || venueId === "all") return [];

      const { data: counts, error: countsErr } = await supabase
        .from("stock_counts")
        .select("*")
        .eq("venue_id", venueId)
        .order("count_date", { ascending: false });

      if (countsErr) throw countsErr;
      if (!counts?.length) return [];

      const countIds = counts.map((c) => c.id);
      const { data: items, error: itemsErr } = await supabase
        .from("stock_count_items")
        .select("*")
        .in("stock_count_id", countIds);

      if (itemsErr) throw itemsErr;

      const itemsByCount = (items ?? []).reduce<
        Record<string, StockCountItem[]>
      >((acc, item) => {
        if (!acc[item.stock_count_id]) acc[item.stock_count_id] = [];
        acc[item.stock_count_id].push(item as StockCountItem);
        return acc;
      }, {});

      return counts.map((c) => ({
        ...c,
        count_date: new Date(c.count_date),
        items: itemsByCount[c.id] ?? [],
      })) as StockCount[];
    },
    enabled: !!venueId && venueId !== "all",
  });
}

// ── Fetch single stock count ────────────────────────────────────────

export function useStockCountDetail(id: string | undefined) {
  return useQuery({
    queryKey: stockCountKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;

      const { data: count, error: countErr } = await supabase
        .from("stock_counts")
        .select("*")
        .eq("id", id)
        .single();

      if (countErr) throw countErr;

      const { data: items, error: itemsErr } = await supabase
        .from("stock_count_items")
        .select("*")
        .eq("stock_count_id", id);

      if (itemsErr) throw itemsErr;

      return {
        ...count,
        count_date: new Date(count.count_date),
        items: (items ?? []) as StockCountItem[],
      } as StockCount;
    },
    enabled: !!id,
  });
}

// ── Fetch inventory locations ───────────────────────────────────────

export function useInvLocations() {
  const { currentVenue } = useAuth();
  const venueId = currentVenue?.id ?? "";

  return useQuery({
    queryKey: stockCountKeys.locations(venueId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inv_locations")
        .select("id, name, type, code, display_order, is_active, venue_id")
        .eq("venue_id", venueId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return (data ?? []) as InvLocation[];
    },
    enabled: !!venueId && venueId !== "all",
  });
}

// ── Fetch ingredients for counting ──────────────────────────────────

export function useCountIngredients() {
  const { currentVenue } = useAuth();
  const venueId = currentVenue?.id ?? "";

  return useQuery({
    queryKey: stockCountKeys.ingredients(venueId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select(
          "id, name, category, unit, current_stock, par_level, cost_per_unit, product_code, supplier_id, supplier_name, active, venue_id, pack_to_base_factor, base_unit, pack_size_text",
        )
        .eq("venue_id", venueId)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return (data ?? []) as IngredientWithLocation[];
    },
    enabled: !!venueId && venueId !== "all",
  });
}

// ── Create / save stock count ───────────────────────────────────────

export function useCreateStockCount() {
  const queryClient = useQueryClient();
  const { currentVenue } = useAuth();

  return useMutation({
    mutationFn: async (count: StockCount) => {
      // Insert the count header
      const { error: countErr } = await supabase.from("stock_counts").insert([
        {
          id: count.id,
          org_id: count.org_id,
          venue_id: count.venue_id,
          count_number: count.count_number,
          count_date:
            count.count_date instanceof Date
              ? count.count_date.toISOString()
              : count.count_date,
          counted_by_user_id: count.counted_by_user_id,
          counted_by_name: count.counted_by_name,
          status: count.status,
          total_variance_value: count.total_variance_value,
          notes: count.notes ?? null,
        },
      ]);

      if (countErr) throw countErr;

      // Insert items
      if (count.items?.length) {
        const itemRows = count.items.map((item) => ({
          id: item.id,
          stock_count_id: count.id,
          ingredient_id: item.ingredient_id,
          ingredient_name: item.ingredient_name,
          expected_quantity: item.expected_quantity,
          actual_quantity: item.actual_quantity,
          variance: item.variance,
          variance_value: item.variance_value,
        }));

        const { error: itemsErr } = await supabase
          .from("stock_count_items")
          .insert(itemRows);

        if (itemsErr) throw itemsErr;
      }

      return count;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stockCountKeys.list(currentVenue?.id ?? ""),
      });
    },
    onError: (err) => {
      console.error("Failed to create stock count:", err);
      toast.error("Failed to save stock count");
    },
  });
}

// ── Complete stock count (update status + ingredient stock levels) ──

export function useCompleteStockCount() {
  const queryClient = useQueryClient();
  const { currentVenue } = useAuth();

  return useMutation({
    mutationFn: async ({
      countId,
      items,
      managerNote,
    }: {
      countId: string;
      items: StockCountItem[];
      managerNote?: string;
    }) => {
      // Update count status
      const updatePayload: Record<string, unknown> = { status: "completed" };
      if (managerNote) updatePayload.notes = managerNote;

      const { error: statusErr } = await supabase
        .from("stock_counts")
        .update(updatePayload)
        .eq("id", countId);

      if (statusErr) throw statusErr;

      // Update ingredient stock levels
      for (const item of items) {
        const { error } = await supabase
          .from("ingredients")
          .update({ current_stock: item.actual_quantity })
          .eq("id", item.ingredient_id);

        if (error) throw error;
      }

      return countId;
    },
    onSuccess: () => {
      const venueId = currentVenue?.id ?? "";
      queryClient.invalidateQueries({
        queryKey: stockCountKeys.list(venueId),
      });
      queryClient.invalidateQueries({
        queryKey: stockCountKeys.ingredients(venueId),
      });
    },
    onError: (err) => {
      console.error("Failed to complete stock count:", err);
      toast.error("Failed to complete stock count");
    },
  });
}

// ── Approve & close (reviewed status + update ingredient stock) ─────

export function useApproveStockCount() {
  const queryClient = useQueryClient();
  const { currentVenue } = useAuth();

  return useMutation({
    mutationFn: async ({
      countId,
      items,
      managerNote,
    }: {
      countId: string;
      items: StockCountItem[];
      managerNote?: string;
    }) => {
      const updatePayload: Record<string, unknown> = { status: "reviewed" };
      if (managerNote) updatePayload.notes = managerNote;

      const { error: statusErr } = await supabase
        .from("stock_counts")
        .update(updatePayload)
        .eq("id", countId);

      if (statusErr) throw statusErr;

      // Update ingredient current_stock from actual_quantity
      for (const item of items) {
        const { error } = await supabase
          .from("ingredients")
          .update({ current_stock: item.actual_quantity })
          .eq("id", item.ingredient_id);

        if (error) throw error;
      }

      return countId;
    },
    onSuccess: () => {
      const venueId = currentVenue?.id ?? "";
      queryClient.invalidateQueries({
        queryKey: stockCountKeys.list(venueId),
      });
      queryClient.invalidateQueries({
        queryKey: stockCountKeys.ingredients(venueId),
      });
      toast.success("Stock count approved and inventory updated");
    },
    onError: (err) => {
      console.error("Failed to approve stock count:", err);
      toast.error("Failed to approve stock count");
    },
  });
}
