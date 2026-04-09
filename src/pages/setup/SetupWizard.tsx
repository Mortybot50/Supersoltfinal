import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, Loader2, Sparkles } from "lucide-react";
import BusinessDetailsStep from "./steps/BusinessDetailsStep";
import AddVenuesStep from "./steps/AddVenuesStep";
import ConnectPosStep from "./steps/ConnectPosStep";
import InviteTeamStep from "./steps/InviteTeamStep";
import ReviewStep from "./steps/ReviewStep";

const STEPS = [
  { number: 1, title: "Business Details", description: "Your organisation info" },
  { number: 2, title: "Add Venues", description: "Set up your locations" },
  { number: 3, title: "Connect POS", description: "Link your point of sale" },
  { number: 4, title: "Invite Team", description: "Bring your team on board" },
  { number: 5, title: "Review & Go Live", description: "Confirm and launch" },
] as const;

export default function SetupWizard() {
  const { user, currentOrg, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [checking, setChecking] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
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

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  }, []);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleGoLive = useCallback(() => {
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const handleSkipToDemo = useCallback(async () => {
    if (!session) return;
    
    setSeedingDemo(true);
    try {
      const response = await fetch('/api/dev/seed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Refresh the page to reload with new demo org
        window.location.href = '/dashboard';
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create demo organization');
      }
    } catch (error) {
      console.error('Demo seed error:', error);
      setSeedingDemo(false);
    }
  }, [session]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no currentOrg after loading, user needs to create one via the wizard
  // Don't block — show the wizard

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">SuperSolt</h1>
          </div>
          <p className="text-muted-foreground">Let&apos;s get your business set up</p>
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of {STEPS.length}</span>
            <span className="text-sm text-muted-foreground">{STEPS[currentStep - 1].title}</span>
          </div>
          <Progress value={progress} className="h-2 mb-4" />
          <div className="flex justify-between">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className={`text-center flex-1 ${
                  step.number === currentStep
                    ? "text-primary font-medium"
                    : step.number < currentStep
                    ? "text-green-600"
                    : "text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-sm ${
                    step.number === currentStep
                      ? "bg-primary text-primary-foreground"
                      : step.number < currentStep
                      ? "bg-green-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.number < currentStep ? "✓" : step.number}
                </div>
                <span className="text-xs hidden sm:block">{step.title}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Demo Mode Toggle - Show on step 1 */}
        {currentStep === 1 && (
          <Alert className="border-amber-200 bg-amber-50">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-amber-800">
                Skip setup with demo data? Creates a sample restaurant with staff, menu, and sales.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipToDemo}
                disabled={seedingDemo}
                className="ml-4 border-amber-300 hover:bg-amber-100"
              >
                {seedingDemo ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Creating demo...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-3 w-3" />
                    Skip to Demo
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {currentStep === 1 && (
          <BusinessDetailsStep orgId={currentOrg?.id ?? ""} onNext={handleNext} />
        )}
        {currentStep === 2 && currentOrg && (
          <AddVenuesStep orgId={currentOrg.id} userId={user?.id ?? ""} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 3 && currentOrg && (
          <ConnectPosStep orgId={currentOrg.id} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 4 && currentOrg && (
          <InviteTeamStep orgId={currentOrg.id} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 5 && currentOrg && (
          <ReviewStep orgId={currentOrg.id} onBack={handleBack} onGoLive={handleGoLive} />
        )}
      </div>
    </div>
  );
}
