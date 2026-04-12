import { useEffect } from "react";
import { useDataStore } from "@/lib/store/dataStore";

/**
 * Hook to automatically load orders from database on mount
 */
export function useLoadOrders() {
  const loadOrdersFromDB = useDataStore((state) => state.loadOrdersFromDB);

  useEffect(() => {
    loadOrdersFromDB();
  }, [loadOrdersFromDB]);
}
