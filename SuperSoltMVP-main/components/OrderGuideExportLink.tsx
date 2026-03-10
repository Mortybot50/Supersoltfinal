"use client";
import Link from "next/link";
import { track } from "@/lib/analytics";

interface OrderGuideExportLinkProps {
  start: Date;
  days: number;
  safetyDays: number;
}

export function OrderGuideExportLink({ start, days, safetyDays }: OrderGuideExportLinkProps) {
  const handleClick = () => {
    track("order_guide_exported", { days, safetyDays });
  };

  return (
    <Link
      href={`/api/inventory/order-guide/export?start=${encodeURIComponent(start.toISOString())}&days=${days}&safetyDays=${safetyDays}`}
      className="rounded-md bg-[hsl(var(--accent))] px-3 py-2 text-sm text-white hover:opacity-90"
      data-testid="button-export-csv"
      onClick={handleClick}
    >
      Export CSV
    </Link>
  );
}
