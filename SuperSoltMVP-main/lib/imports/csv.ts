export interface ParseResult {
  rows: Record<string, string>[];
  errors: string[];
}

export function parseCsv(text: string): ParseResult {
  const errors: string[] = [];
  const rows: Record<string, string>[] = [];

  try {
    const lines = text.trim().split(/\r?\n/);
    
    if (lines.length === 0) {
      errors.push("CSV file is empty");
      return { rows, errors };
    }

    // Parse header row
    const headerLine = lines[0];
    const headers = parseLineSimple(headerLine);
    
    if (headers.length === 0) {
      errors.push("CSV header row is empty");
      return { rows, errors };
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = parseLineSimple(line);
      
      if (values.length !== headers.length) {
        errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
        continue;
      }

      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j].toLowerCase().replace(/\s+/g, "_")] = values[j];
      }
      rows.push(row);
    }
  } catch (error: any) {
    errors.push(`Parse error: ${error.message}`);
  }

  return { rows, errors };
}

function parseLineSimple(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field delimiter
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}
