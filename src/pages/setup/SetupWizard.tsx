import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import BusinessDetailsStep from "./steps/BusinessDetailsStep";
import AddVenuesStep from "./steps/AddVenuesStep";
import ConnectPosStep from "./steps/ConnectPosStep";
import InviteTeamStep from "./steps/InviteTeamStep";
import ReviewStep from "./steps/ReviewStep";
import SetupProgress, { Step } from "@/components/onboarding/SetupProgress";
import { motion, AnimatePresence } from "framer-motion";

const STEPS: Step[] = [
  {
    number: 1,
    title: "Business Details",
    description: "Your organisation info",
  },
  { number: 2, title: "Add Venues", description: "Set up your locations" },
  {
    number: 3,
    title: "Connect POS",
    description: "Link your point of sale",
  },
  {
    number: 4,
    title: "Invite Team",
    description: "Bring your team on board",
  },
  { number: 5, title: "Review & Go Live", description: "Confirm and launch" },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
  }),
};

const slideTransition = {
  x: { type: "spring", stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

export default function SetupWizard() {
  const { user, currentOrg, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [[page, direction], setPage] = useState([1, 0]);
  const [checking, setChecking] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    // Redirect to login if not authenticated
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    // currentOrg may be null briefly after signup — wait briefly, then show wizard anyway
    if (!currentOrg) {
      const timeout = setTimeout(() => {
        setChecking(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }

    const checkOnboarding = async () => {
      try {
        const [orgRes, venueRes] = await Promise.all([
          supabase
            .from("organizations")
            .select("*")
            .eq("id", currentOrg.id)
            .single(),
          supabase
            .from("venues")
            .select("id")
            .eq("org_id", currentOrg.id)
            .limit(1),
        ]);

        const orgData = orgRes.data as Record<string, unknown> | null;
        const settings = orgData?.settings as Record<string, unknown> | null;
        const hasVenues = (venueRes.data?.length ?? 0) > 0;
        const onboardingCompleted = settings?.onboarding_completed === true;

        if (hasVenues && onboardingCompleted) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch {
        // Continue with wizard on error
      }
      setChecking(false);
    };

    checkOnboarding();
  }, [user, currentOrg, authLoading, navigate]);

  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection]);
  };

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      paginate(1);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      paginate(-1);
    }
  }, [currentStep]);

  const handleGoLive = useCallback(() => {
    setIsComplete(true);
    setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 2000);
  }, [navigate]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground animate-pulse">
            Preparing your workspace...
          </p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="text-center"
        >
          <div className="relative">
            <CheckCircle2 className="w-24 h-24 text-primary mx-auto mb-6" />
            <motion.div
              className="absolute -inset-4"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <CheckCircle2 className="w-32 h-32 text-primary/20" />
            </motion.div>
          </div>
          <h2 className="text-3xl font-bold mb-2">You're all set!</h2>
          <p className="text-muted-foreground mb-4">
            Welcome to SuperSolt. Let's transform your business.
          </p>
          <div className="flex items-center justify-center gap-2 text-primary">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-medium">Launching dashboard...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="text-center py-8 sm:py-12">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Welcome to SuperSolt
            </h1>
            <p className="text-muted-foreground text-lg">
              Let's get your restaurant operations running smoothly
            </p>
          </motion.div>
        </div>

        {/* Progress */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 sm:mb-12"
        >
          <SetupProgress
            steps={STEPS}
            currentStep={currentStep}
            className="px-2 sm:px-0"
          />
        </motion.div>

        {/* Step Content */}
        <div className="relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              className="w-full"
            >
              <Card
                className={cn(
                  "shadow-xl border-muted/50",
                  "bg-gradient-to-br from-card via-card to-muted/5"
                )}
              >
                {currentStep === 1 && (
                  <BusinessDetailsStep
                    orgId={currentOrg?.id ?? ""}
                    onNext={handleNext}
                  />
                )}
                {currentStep === 2 && currentOrg && (
                  <AddVenuesStep
                    orgId={currentOrg.id}
                    userId={user?.id ?? ""}
                    onNext={handleNext}
                    onBack={handleBack}
                  />
                )}
                {currentStep === 3 && currentOrg && (
                  <ConnectPosStep
                    orgId={currentOrg.id}
                    onNext={handleNext}
                    onBack={handleBack}
                  />
                )}
                {currentStep === 4 && currentOrg && (
                  <InviteTeamStep
                    orgId={currentOrg.id}
                    onNext={handleNext}
                    onBack={handleBack}
                  />
                )}
                {currentStep === 5 && currentOrg && (
                  <ReviewStep
                    orgId={currentOrg.id}
                    onBack={handleBack}
                    onGoLive={handleGoLive}
                  />
                )}
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile navigation hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center sm:hidden"
        >
          <p className="text-xs text-muted-foreground">
            {currentStep < STEPS.length
              ? "Complete this step to continue"
              : "Review and launch your dashboard"}
          </p>
        </motion.div>
      </div>
    </div>
  );
}