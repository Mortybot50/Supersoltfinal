import { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  delta,
  icon
}: { label: string; value: string; delta?: { sign: "up"|"down"; text: string } | null; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {delta ? (
        <div className="mt-1 text-xs">
          <span className={delta.sign === "up" ? "text-emerald-600" : "text-rose-600"}>
            {delta.sign === "up" ? "▲ " : "▼ "}{delta.text}
          </span>
        </div>
      ) : null}
    </div>
  );
}
