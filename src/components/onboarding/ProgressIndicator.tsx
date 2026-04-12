import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  progress: number; // 0-100
}

export default function ProgressIndicator({
  progress,
}: ProgressIndicatorProps) {
  return (
    <div className="mt-2">
      <Progress value={progress} className="h-1" />
      <p className="text-xs text-muted-foreground mt-1">{progress}% complete</p>
    </div>
  );
}
