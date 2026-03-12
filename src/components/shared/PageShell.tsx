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
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Optional page-level sidebar */}
      {sidebar}

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Toolbar */}
        {toolbar}

        {/* Scrollable content with page-enter animation */}
        <div className={cn("flex-1 overflow-auto animate-page-enter", className)}>
          {children}
        </div>

        {/* Optional footer */}
        {footer}
      </div>
    </div>
  )
}
