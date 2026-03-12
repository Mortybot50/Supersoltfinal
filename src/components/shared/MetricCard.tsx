import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MetricCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
  iconBg?: string
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  trendLabel?: string
  variant?: "card" | "inline" | "sidebar"
  className?: string
}

export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendValue,
  trendLabel,
  variant = "card",
  className,
}: MetricCardProps) {
  const trendColor =
    trend === "up" ? "text-emerald-600 dark:text-emerald-400" :
    trend === "down" ? "text-red-500 dark:text-red-400" :
    "text-muted-foreground"

  const TrendIcon =
    trend === "up" ? TrendingUp :
    trend === "down" ? TrendingDown :
    Minus

  if (variant === "inline") {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5", className)}>
        {Icon && <Icon className={cn("h-4 w-4", iconColor || "text-muted-foreground")} />}
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        {trend && trend !== "neutral" && (
          <TrendIcon className={cn("h-3 w-3", trendColor)} />
        )}
      </div>
    )
  }

  if (variant === "sidebar") {
    return (
      <div className={className}>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    )
  }

  // card variant — full design with icon accent box
  return (
    <div className={cn(
      "rounded-xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-md transition-all duration-200",
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            iconBg || "bg-brand-50 dark:bg-brand-900/20"
          )}>
            <Icon className={cn("h-5 w-5", iconColor || "text-brand-600 dark:text-brand-400")} />
          </div>
        )}
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
        {(subtext || trendLabel) && (
          <p className="text-xs text-muted-foreground">
            {trendLabel || subtext}
          </p>
        )}
      </div>
    </div>
  )
}
