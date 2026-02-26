import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Redirects to /setup if onboarding is not complete.
 * Only runs on protected dashboard routes (not on /setup itself).
 */
export function useOnboardingRedirect() {
  const { currentOrg, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !currentOrg || location.pathname === "/setup") {
      setChecked(true);
      return;
    }

    const check = async () => {
      try {
        const { data } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", currentOrg.id)
          .single();

        const orgData = data as Record<string, unknown> | null;
        const settings = orgData?.settings as Record<string, unknown> | null;
        const onboardingCompleted = settings?.onboarding_completed === true;

        if (!onboardingCompleted) {
          navigate("/setup", { replace: true });
          return;
        }
      } catch {
        // Don't block on error
      }
      setChecked(true);
    };

    check();
  }, [currentOrg, loading, navigate, location.pathname]);

  return checked;
}
