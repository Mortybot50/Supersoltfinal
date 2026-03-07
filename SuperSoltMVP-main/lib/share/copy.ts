export function buildSupplierText(
  supplierName: string,
  lines: {
    ingredient: string;
    packSizeLabel?: string;
    packs: number;
    notes?: string;
  }[]
) {
  const rows = lines.map((l) =>
    `- ${l.ingredient}${l.packSizeLabel ? ` (${l.packSizeLabel})` : ""} × ${l.packs}${
      l.notes ? `  // ${l.notes}` : ""
    }`
  );
  return [`Order for ${supplierName}`, ...rows].join("\n");
}

export function buildAllSuppliersText(
  groups: {
    supplier: string;
    lines: {
      ingredient: string;
      packSizeLabel?: string;
      packs: number;
      notes?: string;
    }[];
  }[]
) {
  return groups.map((g) => buildSupplierText(g.supplier, g.lines)).join("\n\n");
}
