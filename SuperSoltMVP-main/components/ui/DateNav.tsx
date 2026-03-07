"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Period = "day" | "week" | "month";

export default function DateNav({
  onChange,
}: {
  onChange: (p: Period, startISO: string) => void;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [start, setStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const fmtRange = () => {
    const f = (d: Date) =>
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d);
    
    if (period === "day") return f(start);
    
    if (period === "week") {
      const s = new Date(start);
      const e = new Date(start);
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
      e.setDate(s.getDate() + 6);
      return `${f(s)} – ${f(e)}`;
    }
    
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return `${f(s)} – ${f(e)}`;
  };

  useEffect(() => {
    onChange(period, start.toISOString());
  }, [period, start, onChange]);

  const shift = (dir: -1 | 1) => {
    const d = new Date(start);
    if (period === "day") d.setDate(d.getDate() + dir);
    else if (period === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setStart(d);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="date-nav">
      <div className="inline-flex rounded-md border border-border">
        {(["day", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-sm first:rounded-l-md last:rounded-r-md transition-colors ${
              period === p ? "bg-accent text-accent-foreground" : "hover-elevate"
            }`}
            data-testid={`button-period-${p}`}
          >
            {p[0].toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => shift(-1)}
          variant="outline"
          size="sm"
          data-testid="button-prev"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <Button
          onClick={() => setStart(new Date())}
          variant="outline"
          size="sm"
          data-testid="button-today"
        >
          Today
        </Button>
        <Button
          onClick={() => shift(1)}
          variant="outline"
          size="sm"
          data-testid="button-next"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-range">
        {fmtRange()}
      </div>
    </div>
  );
}
