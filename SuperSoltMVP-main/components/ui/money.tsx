// components/ui/money.tsx
"use client"
import { formatAUD } from "@/lib/currency"

export function Money({
  value,
  className,
}: {
  value: number | null | undefined
  className?: string
}) {
  return <span className={className}>{formatAUD(value ?? 0)}</span>
}
