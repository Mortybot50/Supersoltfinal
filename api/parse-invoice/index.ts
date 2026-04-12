/**
 * POST /api/parse-invoice
 *
 * Accepts a base64-encoded PDF or image and returns structured invoice data
 * extracted via Claude claude-sonnet-4-6 (vision).
 *
 * Body:
 *   { file_base64: string, mime_type: string, filename?: string }
 *
 * Returns: ParsedInvoice JSON
 */

import type { VercelRequest, VercelResponse } from "../square/_lib.js";
import { extractToken, verifyUser } from "../square/_lib.js";
import Anthropic from "@anthropic-ai/sdk";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(orgId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(orgId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(orgId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

interface ParseInvoiceBody {
  file_base64: string;
  mime_type: string;
  filename?: string;
}

const EXTRACTION_PROMPT = `You are an expert accounts payable assistant. Extract structured data from this supplier invoice image.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "invoice_number": string | null,
  "invoice_date": string | null,        // ISO date YYYY-MM-DD
  "due_date": string | null,            // ISO date YYYY-MM-DD
  "supplier_name": string | null,
  "supplier_abn": string | null,        // Australian Business Number, numbers only
  "subtotal": number | null,            // excluding tax, as decimal (e.g. 123.45)
  "tax_amount": number | null,          // GST/tax amount, as decimal
  "total_amount": number | null,        // total including tax, as decimal
  "currency": "AUD",
  "document_type": "invoice" | "credit_note" | "statement",
  "overall_confidence": number,         // 0.0–1.0 for overall extraction quality
  "raw_text_preview": string,           // first 200 chars of visible text
  "line_items": [
    {
      "raw_description": string,        // exact product description as shown
      "extracted_quantity": number | null,
      "extracted_unit": string | null,  // e.g. "kg", "ea", "L", "box", "case"
      "extracted_unit_price": number | null,
      "extracted_line_total": number | null,
      "extracted_tax": number | null,
      "extracted_discount": number | null,
      "confidence_score": number        // 0.0–1.0 per line
    }
  ]
}

Rules:
- All monetary values as decimals (dollars, not cents)
- If total is negative, set document_type to "credit_note"
- If you cannot find a field, use null
- Include ALL line items visible in the invoice
- For multi-page invoices, include items from all pages visible
- ABN format: digits only, no spaces (e.g. "12345678901")
- Do not guess fields you cannot see clearly — use null and lower the confidence_score`;

const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Reject oversized requests before any processing
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res
      .status(413)
      .json({ error: "Request body too large. Maximum size is 10MB." });
  }

  // Auth — verify caller is a valid Supabase user
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required" });

  const {
    user,
    error: authError,
    status: authStatus,
  } = await verifyUser(token);
  if (!user) return res.status(authStatus!).json({ error: authError });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[parse-invoice] ANTHROPIC_API_KEY not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const body = req.body as ParseInvoiceBody;
  if (!body?.file_base64 || !body?.mime_type) {
    return res
      .status(400)
      .json({ error: "file_base64 and mime_type are required" });
  }

  // Guard on base64 payload size (base64 overhead ≈ 33%; 10MB binary → ~13.3MB encoded)
  if (body.file_base64.length > Math.ceil(MAX_BODY_BYTES * 1.4)) {
    return res
      .status(413)
      .json({ error: "File too large. Maximum size is 10MB." });
  }

  // Basic MIME type validation
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (!allowedTypes.includes(body.mime_type)) {
    return res
      .status(400)
      .json({ error: "Unsupported file type. Use PDF, JPEG, PNG, or WebP." });
  }

  // Rate limit by user ID
  if (!checkRateLimit(user.id)) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please wait a moment." });
  }

  try {
    const client = new Anthropic({ apiKey });

    // Claude vision API call
    // PDF: use document type; images: use image type
    const isPdf = body.mime_type === "application/pdf";

    type ImageMediaType =
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const contentBlock = isPdf
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: body.file_base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: body.mime_type as ImageMediaType,
            data: body.file_base64,
          },
        };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return res.status(500).json({ error: "No text response from AI model" });
    }

    // Parse the JSON response
    let parsed: unknown;
    try {
      // Strip any accidental markdown fences
      const cleaned = textBlock.text
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        "[parse-invoice] Failed to parse AI response as JSON:",
        textBlock.text.slice(0, 500),
      );
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    return res.status(200).json(parsed);
  } catch (err: unknown) {
    console.error("[parse-invoice] Unhandled error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg || "Internal server error" });
  }
}
