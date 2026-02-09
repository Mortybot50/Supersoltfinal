import { cn } from "@/lib/utils"

interface PageShellProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function PageShell({
  children,
  sidebar,
  toolbar,
  footer,
  className,
}: PageShellProps) {
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Optional page-level sidebar */}
      {sidebar}

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Toolbar */}
        {toolbar}

        {/* Scrollable content */}
        <div className={cn("flex-1 overflow-auto", className)}>
          {children}
        </div>

        {/* Optional footer */}
        {footer}
      </div>
    </div>
  )
}
