import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

interface MetricCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
  trend?: "up" | "down" | "neutral"
  variant?: "card" | "inline" | "sidebar"
}

export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor,
  trend,
  variant = "card",
}: MetricCardProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        {Icon && <Icon className={cn("h-4 w-4", iconColor || "text-muted-foreground")} />}
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
        {trend && trend !== "neutral" && (
          trend === "up"
            ? <TrendingUp className="h-3 w-3 text-green-500" />
            : <TrendingDown className="h-3 w-3 text-red-500" />
        )}
      </div>
    )
  }

  if (variant === "sidebar") {
    return (
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    )
  }

  // card variant
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className={cn("h-4 w-4", iconColor || "text-muted-foreground")} />}
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {trend && trend !== "neutral" && (
          trend === "up"
            ? <TrendingUp className="h-3 w-3 text-green-500 ml-auto" />
            : <TrendingDown className="h-3 w-3 text-red-500 ml-auto" />
        )}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs text-muted-foreground mt-1">{subtext}</div>}
    </div>
  )
}
