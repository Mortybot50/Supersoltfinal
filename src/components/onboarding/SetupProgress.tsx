import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export interface Step {
  number: number;
  title: string;
  description: string;
}

interface SetupProgressProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export default function SetupProgress({
  steps,
  currentStep,
  className,
}: SetupProgressProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: Horizontal scrollable progress */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2 px-4">
          <span className="text-sm font-medium">
            Step {currentStep} of {steps.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {steps[currentStep - 1].title}
          </span>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center px-4">
            <div className="w-full h-1 bg-muted rounded-full">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="relative flex overflow-x-auto pb-4 px-4 scrollbar-hide">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="flex-shrink-0 flex items-center"
                style={{
                  width: `${100 / steps.length}%`,
                  minWidth: "80px",
                }}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                    step.number === currentStep
                      ? "bg-primary text-primary-foreground shadow-lg scale-110"
                      : step.number < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step.number < currentStep ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: Full progress with labels */}
      <div className="hidden sm:block">
        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{
                width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
              }}
            />
          </div>
          <div className="relative flex justify-between">
            {steps.map((step) => (
              <div
                key={step.number}
                className={cn(
                  "flex flex-col items-center group transition-all duration-300",
                  step.number === currentStep && "scale-105"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium mb-2 transition-all duration-300",
                    step.number === currentStep
                      ? "bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20"
                      : step.number < currentStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10"
                  )}
                >
                  {step.number < currentStep ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <div
                  className={cn(
                    "text-center transition-opacity duration-300",
                    step.number !== currentStep && "sm:opacity-75"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium mb-0.5",
                      step.number === currentStep
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[120px]">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}