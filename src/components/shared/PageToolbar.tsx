import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateNavigation {
  label: string
  onBack: () => void
  onForward: () => void
}

interface PrimaryAction {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
  variant?: "primary" | "export" | "default"
}

interface PageToolbarProps {
  title?: string
  dateNavigation?: DateNavigation
  filters?: React.ReactNode
  actions?: React.ReactNode
  primaryAction?: PrimaryAction
  className?: string
}

export function PageToolbar({
  title,
  dateNavigation,
  filters,
  actions,
  primaryAction,
  className,
}: PageToolbarProps) {
  return (
    <div
      className={cn(
        "bg-card border-b border-border/60 px-6 py-3 flex items-center gap-3 flex-wrap print:hidden shrink-0",
        className
      )}
    >
      {/* Title */}
      {title && (
        <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">{title}</h1>
      )}

      {/* Date Navigation */}
      {dateNavigation && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border/60"
            onClick={dateNavigation.onBack}
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-9 px-3 font-medium text-sm border-border/60 min-w-[120px] justify-center">
            {dateNavigation.label}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-border/60"
            onClick={dateNavigation.onForward}
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Inline Filters */}
      {filters}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {actions}

        {primaryAction && (
          <Button
            className={cn(
              "h-9 btn-press",
              primaryAction.variant === "export"
                ? "bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-500 dark:hover:bg-teal-600"
                : ""
            )}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.icon && (
              <primaryAction.icon className="h-4 w-4 mr-2" />
            )}
            {primaryAction.label}
          </Button>
        )}
      </div>
    </div>
  )
}
