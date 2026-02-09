import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Copy, FileText, Clock, Zap } from "lucide-react"
import { ShiftTemplate } from "@/types"
import { formatTimeCompact } from "@/lib/utils/rosterCalculations"

interface QuickBuildPopoverProps {
  shiftTemplates: ShiftTemplate[]
  onCopyPreviousWeek: () => void
  onApplyTemplate: (template: ShiftTemplate) => void
  children: React.ReactNode
}

export function QuickBuildPopover({
  shiftTemplates,
  onCopyPreviousWeek,
  onApplyTemplate,
  children,
}: QuickBuildPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" side="right">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Zap className="h-4 w-4" />
            Quick Build
          </div>
        </div>

        {/* Templates */}
        <div className="p-2">
          <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Templates
          </div>

          {shiftTemplates.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              No templates saved yet.
              <br />
              Create one from the Rostering menu.
            </div>
          ) : (
            <div className="space-y-0.5">
              {shiftTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant="ghost"
                  className="w-full justify-start h-auto py-2 px-2 text-left"
                  onClick={() => onApplyTemplate(template)}
                >
                  <div>
                    <div className="text-sm font-medium">{template.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {formatTimeCompact(template.start_time)} - {formatTimeCompact(template.end_time)}
                      {template.break_minutes > 0 && (
                        <span>· {template.break_minutes}m break</span>
                      )}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Copy Shifts */}
        <div className="p-2">
          <div className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
            <Copy className="h-3 w-3" />
            Copy Shifts
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start h-auto py-2 px-2"
            onClick={onCopyPreviousWeek}
          >
            <div>
              <div className="text-sm font-medium">Copy Previous Week</div>
              <div className="text-xs text-muted-foreground">
                Duplicate last week's roster to this week
              </div>
            </div>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
