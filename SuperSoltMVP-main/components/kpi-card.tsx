import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface KPIProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  format?: "currency" | "number" | "time"
  testId?: string
}

export function KPI({ title, value, change, changeLabel, format, testId }: KPIProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0
  
  const formatValue = () => {
    if (format === "currency" && typeof value === "number") {
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(value)
    }
    if (format === "time") {
      return `${value} min`
    }
    return value
  }

  return (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`${testId}-value`}>
          {formatValue()}
        </div>
        {change !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            {isPositive && (
              <TrendingUp className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
            )}
            {isNegative && (
              <TrendingDown className="h-3 w-3 text-red-500 dark:text-red-400" />
            )}
            <span
              className={cn(
                "font-medium",
                isPositive && "text-emerald-600 dark:text-emerald-400",
                isNegative && "text-red-600 dark:text-red-400"
              )}
              data-testid={`${testId}-change`}
            >
              {isPositive ? "+" : ""}
              {change.toFixed(1)}%
            </span>
            {changeLabel && (
              <span className="text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
