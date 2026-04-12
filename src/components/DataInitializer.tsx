import { useEffect, useRef } from "react";
import { useDataStore } from "@/lib/store/dataStore";

/**
 * Component that initializes all data from the database on app startup
 * This ensures data persists across sessions and page refreshes
 */
export default function DataInitializer() {
  const { initializeData } = useDataStore();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only initialize once per session
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initializeData();
    }
  }, [initializeData]);

  return null; // This component doesn't render anything
}
