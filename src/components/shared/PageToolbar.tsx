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
  variant?: "teal" | "default"
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
        "bg-white dark:bg-gray-800 border-b px-4 py-2 flex items-center gap-3 flex-wrap print:hidden shrink-0",
        className
      )}
    >
      {/* Title */}
      {title && (
        <h1 className="text-sm font-semibold whitespace-nowrap">{title}</h1>
      )}

      {/* Date Navigation */}
      {dateNavigation && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={dateNavigation.onBack}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-8 px-3 font-medium text-sm">
            {dateNavigation.label}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={dateNavigation.onForward}
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
              "h-8",
              primaryAction.variant === "teal"
                ? "bg-teal-500 hover:bg-teal-600 text-white"
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
