import Papa from "papaparse";

export type Parsed = { 
  headers: string[]; 
  rows: any[] 
};

/**
 * Server-side CSV parser with delimiter detection and BOM handling
 */
export async function parseCsv(text: string): Promise<Parsed> {
  // Remove BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  // Parse with papaparse - detect delimiter automatically
  const result = Papa.parse<Record<string, string>>(cleanText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  if (result.errors && result.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
  }

  const headers = result.meta.fields || [];
  const rows = result.data;

  return { headers, rows };
}
