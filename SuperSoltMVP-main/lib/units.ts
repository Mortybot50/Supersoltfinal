export type Unit = "g" | "kg" | "ml" | "l" | "each";

export function toBase(qty: number, unit: Unit): { qty: number; base: "g" | "ml" | "each" } {
  if (unit === "kg") return { qty: qty * 1000, base: "g" };
  if (unit === "g") return { qty, base: "g" };
  if (unit === "l") return { qty: qty * 1000, base: "ml" };
  if (unit === "ml") return { qty, base: "ml" };
  return { qty, base: "each" };
}

export function sameDimension(a: Unit, b: Unit): boolean {
  const aBase = toBase(1, a).base;
  const bBase = toBase(1, b).base;
  return aBase === bBase;
}

export function formatQtyUnit(qty: number, unit: Unit): string {
  return `${qty.toFixed(2)} ${unit}`;
}
