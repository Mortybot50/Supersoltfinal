// components/ui/Currency.tsx
"use client";
import { formatCurrency } from "@/lib/currency";

export default function Currency({
  value,
  inCents,
  maxFrac,
  className,
}: {
  value: number | null | undefined;
  inCents?: boolean;
  maxFrac?: number;
  className?: string;
}) {
  return <span className={className}>{formatCurrency(value, { inCents, maximumFractionDigits: maxFrac })}</span>;
}
