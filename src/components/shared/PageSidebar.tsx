import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarMetric {
  label: string;
  value: string | number;
}

interface SidebarExtendedMetric {
  label: string;
  value: string | number;
  color?: "green" | "orange" | "red" | "default";
  icon?: React.ComponentType<{ className?: string }>;
}

interface SidebarQuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: number;
}

interface PageSidebarProps {
  title?: string;
  metrics?: SidebarMetric[];
  extendedMetrics?: SidebarExtendedMetric[];
  quickActions?: SidebarQuickAction[];
  warnings?: string[];
  children?: React.ReactNode;
  className?: string;
}

const COLOR_MAP = {
  green: "text-green-400",
  orange: "text-orange-400",
  red: "text-red-400",
  default: "",
} as const;

export function PageSidebar({
  title,
  metrics,
  extendedMetrics,
  quickActions,
  warnings,
  children,
  className,
}: PageSidebarProps) {
  return (
    <div
      className={cn(
        "hidden lg:flex w-[280px] bg-slate-900 dark:bg-slate-950 text-white flex-col print:hidden shrink-0",
        className,
      )}
    >
      {/* Title */}
      {title && (
        <div className="p-4 border-b border-slate-700">
          <span className="text-lg font-semibold">{title}</span>
        </div>
      )}

      {/* Primary Metrics */}
      {metrics && metrics.length > 0 && (
        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">
            Stats
          </div>
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="text-xs text-slate-400">{metric.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Extended Metrics */}
      {extendedMetrics && extendedMetrics.length > 0 && (
        <>
          <Separator className="bg-slate-700" />
          <div className="p-4 space-y-3">
            {extendedMetrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-center justify-between"
              >
                <span className="text-xs text-slate-400">{metric.label}</span>
                <span
                  className={cn(
                    "text-sm font-medium flex items-center gap-1",
                    COLOR_MAP[metric.color || "default"],
                  )}
                >
                  {metric.icon && <metric.icon className="h-3 w-3" />}
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick Actions */}
      {quickActions && quickActions.length > 0 && (
        <>
          <Separator className="bg-slate-700" />
          <div className="p-2 space-y-1">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                className="w-full justify-start text-white hover:bg-slate-700 text-sm"
                onClick={action.onClick}
              >
                <action.icon className="h-4 w-4 mr-2" />
                {action.label}
                {action.badge != null && action.badge > 0 && (
                  <Badge className="ml-auto bg-blue-500">{action.badge}</Badge>
                )}
              </Button>
            ))}
          </div>
        </>
      )}

      {/* Custom Content */}
      {children}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <>
          <Separator className="bg-slate-700" />
          <div className="p-4">
            <div className="flex items-center gap-2 text-orange-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{warnings.length} warnings</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
