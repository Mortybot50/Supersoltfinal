/**
 * Ingredient Matcher Service
 *
 * Fuzzy-matches parsed invoice line item descriptions against existing
 * ingredients using a simple Levenshtein-based similarity score.
 *
 * Thresholds:
 *  >= 0.85  → auto_matched
 *  0.50–0.85 → manual review recommended
 *  < 0.50   → unmatched
 */

import type { Ingredient } from "@/types";
import type { ParsedLineItem } from "./invoiceParser";

export interface MatchResult {
  parsed_item: ParsedLineItem;
  matched_ingredient: Ingredient | null;
  confidence: number;
  match_status:
    | "auto_matched"
    | "manual_matched"
    | "new_ingredient"
    | "unmatched";
  candidates: Array<{ ingredient: Ingredient; score: number }>;
}

// ── String normalisation ──────────────────────────────────────────────

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Levenshtein distance ──────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// ── Similarity score (0–1) ────────────────────────────────────────────

function similarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

// ── Token overlap bonus ───────────────────────────────────────────────
// Boost score if significant word overlap, e.g. "chicken breast" vs "breast of chicken"

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(
    normalise(a)
      .split(" ")
      .filter((w) => w.length > 2),
  );
  const tb = new Set(
    normalise(b)
      .split(" ")
      .filter((w) => w.length > 2),
  );
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  ta.forEach((t) => {
    if (tb.has(t)) overlap++;
  });
  return overlap / Math.max(ta.size, tb.size);
}

function combinedScore(query: string, candidate: string): number {
  const lev = similarity(query, candidate);
  const tok = tokenOverlap(query, candidate);
  // Weighted blend: 60% levenshtein, 40% token overlap
  return lev * 0.6 + tok * 0.4;
}

// ── Main matching function ────────────────────────────────────────────

export function matchLineItems(
  lineItems: ParsedLineItem[],
  existingIngredients: Ingredient[],
): MatchResult[] {
  return lineItems.map((item) => {
    const query = item.raw_description;

    const scored = existingIngredients.map((ing) => ({
      ingredient: ing,
      score: combinedScore(query, ing.name),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);
    const best = top[0];

    let match_status: MatchResult["match_status"];
    let matched_ingredient: Ingredient | null = null;
    let confidence = best?.score ?? 0;

    if (!best || best.score < 0.5) {
      match_status = "unmatched";
      confidence = best?.score ?? 0;
    } else if (best.score >= 0.85) {
      match_status = "auto_matched";
      matched_ingredient = best.ingredient;
    } else {
      match_status = "manual_matched";
      matched_ingredient = best.ingredient;
    }

    return {
      parsed_item: item,
      matched_ingredient,
      confidence,
      match_status,
      candidates: top,
    };
  });
}
