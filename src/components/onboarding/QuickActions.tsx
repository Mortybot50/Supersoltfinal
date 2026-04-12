import { Button } from "@/components/ui/button";

interface QuickAction {
  id: string;
  label: string;
  value: string;
  icon?: string;
  action?: "next" | "skip" | "custom";
}

interface QuickActionsProps {
  actions: QuickAction[];
  onAction: (action: QuickAction) => void;
}

export default function QuickActions({ actions, onAction }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          onClick={() => onAction(action)}
          className="justify-start"
        >
          {action.icon && <span className="mr-2">{action.icon}</span>}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
