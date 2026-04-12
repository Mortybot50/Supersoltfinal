/**
 * Invoice Parser Service
 *
 * Converts a PDF/image file to structured invoice data by calling
 * the /api/parse-invoice serverless function (Claude vision).
 */

import { supabase } from "@/integrations/supabase/client";

export interface ParsedLineItem {
  raw_description: string;
  extracted_quantity: number | null;
  extracted_unit: string | null;
  extracted_unit_price: number | null;
  extracted_line_total: number | null;
  extracted_tax: number | null;
  extracted_discount: number | null;
  confidence_score: number;
}

export interface ParsedInvoice {
  invoice_number: string | null;
  invoice_date: string | null; // ISO date YYYY-MM-DD
  due_date: string | null;
  supplier_name: string | null;
  supplier_abn: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  currency: string;
  document_type: "invoice" | "credit_note" | "statement";
  line_items: ParsedLineItem[];
  overall_confidence: number;
  raw_text_preview: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function parseInvoice(file: File): Promise<ParsedInvoice> {
  const base64 = await fileToBase64(file);

  // Get the current user's JWT to authenticate the API call
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch("/api/parse-invoice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      file_base64: base64,
      mime_type: file.type,
      filename: file.name,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(
      (err as { error: string }).error || `Parse failed: ${response.status}`,
    );
  }

  const result = (await response.json()) as ParsedInvoice;
  return result;
}
