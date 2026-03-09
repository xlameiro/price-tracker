/**
 * Shared utilities for search scrapers.
 */

import { Impit } from "impit";

/**
 * Shared impit instance with Chrome TLS fingerprint + browser header emulation.
 * `browser: "chrome"` makes impit auto-generate realistic Chrome headers
 * (sec-ch-ua, Sec-Fetch-*, Accept, etc.) and use BoringSSL cipher suites
 * — the main signal used by Cloudflare and other WAFs to detect Node.js scrapers.
 */
export const browserClient = new Impit({
  browser: "chrome",
  timeout: 10_000,
  // Override Accept-Language to Spanish so store results are localised
  headers: { "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" },
});

/**
 * Extract the number of units in a pack from a product name.
 * e.g. "Pañales Dodot 44 unidades" → 44, "Dodot T5 42 uds" → 42
 * Handles multi-pack formats: "2 x 44" → 88, "3x48 uds" → 144
 * Input is internal scraped data (not user-controlled).
 */
export function extractPackageSize(name: string): number | undefined {
  const lower = name.toLowerCase();
  const tokens = lower.split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? "";

    // Case 1: inline "NxM" token — e.g. "3x48" or "4x100 g" → 4
    const inlineResult = tryMultiplyOrCount(tok, tokens[i + 1] ?? "");
    if (inlineResult !== undefined) return inlineResult;

    // Case 2: three-token "N x M" — e.g. "2 x 44" or "4 x 100 g" → 4
    const spacedResult = trySpacedMultiply(tokens, i);
    if (spacedResult !== undefined) return spacedResult;

    // Case 3: "N <unit-keyword>" — e.g. "168 uds"
    if (/^\d+$/.test(tok)) {
      const next = (tokens[i + 1] ?? "").replace(/[^a-záéíóúüñ]/g, "");
      if (isUnitKeyword(next)) return Number.parseInt(tok, 10);
    }
  }

  return undefined;
}

function trySpacedMultiply(tokens: string[], i: number): number | undefined {
  const tok = tokens[i] ?? "";
  if (
    !/^\d+$/.test(tok) ||
    !isMultiplierSymbol(tokens[i + 1] ?? "") ||
    !/^\d+$/.test(tokens[i + 2] ?? "")
  ) {
    return undefined;
  }
  // If the token right after M is a weight unit, return just the count
  const tokenAfterM = (tokens[i + 3] ?? "").replace(/[^a-z]/g, "");
  if (isWeightUnit(tokenAfterM)) {
    const count = Number.parseInt(tok, 10);
    return count >= 2 ? count : undefined;
  }
  return applyMultiply(tok, tokens[i + 2] ?? "");
}

function tryMultiplyOrCount(tok: string, nextTok: string): number | undefined {
  const idx = tok.search(/[x×]/);
  if (idx <= 0 || idx === tok.length - 1) return undefined;
  const leftStr = tok.slice(0, idx);
  const rightStr = tok.slice(idx + 1);
  if (!/^\d+$/.test(leftStr) || !/^\d+$/.test(rightStr)) return undefined;
  // If right side is a weight/volume unit in the following token, return unit count
  if (isWeightUnit(nextTok.replace(/[^a-z]/g, ""))) {
    const count = Number.parseInt(leftStr, 10);
    return count >= 2 ? count : undefined;
  }
  return applyMultiply(leftStr, rightStr);
}

function isWeightUnit(word: string): boolean {
  return (
    word === "g" ||
    word === "gr" ||
    word === "kg" ||
    word === "mg" ||
    word === "ml" ||
    word === "cl" ||
    word === "l"
  );
}

function isMultiplierSymbol(tok: string): boolean {
  return tok === "x" || tok === "×";
}

function applyMultiply(leftStr: string, rightStr: string): number | undefined {
  const left = Number.parseInt(leftStr, 10);
  const right = Number.parseInt(rightStr, 10);
  // multiplier 2–9, pack size 20–250 (realistic diaper counts)
  if (left >= 2 && left <= 9 && right >= 20 && right <= 250)
    return left * right;
  return undefined;
}

function isUnitKeyword(word: string): boolean {
  return (
    word === "pañales" ||
    word === "panales" ||
    word.startsWith("ud") || // uds, ud, udn
    word.startsWith("und") || // und (used by some Spanish stores)
    word === "unidades" ||
    word === "unidad"
  );
}

// ---------------------------------------------------------------------------
// parseProductQuantity — extracts weight/volume + unit count from product name
// ---------------------------------------------------------------------------

type NetWeightUnit = "g" | "ml";

/** Result type for parseProductQuantity */
export type ParsedQuantity = {
  /** Number of individual items in the pack (e.g. 3 cans, 44 diapers) */
  packageSize?: number;
  /** Net weight (grams) or volume (millilitres) of a single item */
  netWeight?: number;
  /** Unit for netWeight: 'g' or 'ml' */
  netWeightUnit?: NetWeightUnit;
};

// Matches all recognised weight/volume units, longest-first to avoid ambiguity
// (so "kg" beats "g", "ml" beats "l", "cl" beats "l")
const WEIGHT_UNIT_PAT = "(kg|ml|cl|gr|mg|g|l)";
// Number allowing Spanish decimal comma: 1,5 or 1.5 or plain 42
const NUM_PAT = "(\\d+(?:[,.]\\d+)?)";

// These regexes match product names from internal scraper data, not user input.
// The patterns are safe against ReDoS in practice since the input is bounded
// (product name strings from retailer APIs, typically < 200 chars).
/* eslint-disable sonarjs/slow-regex */

// NxM<unit> or N x M<unit> or N x M <unit>, e.g. "3x112g", "3 x 112 g"
const MULTI_WEIGHT_RE = new RegExp(
  `${NUM_PAT}\\s*[x×]\\s*${NUM_PAT}\\s*${WEIGHT_UNIT_PAT}\\b`,
  "i",
);

// Standalone weight/volume: N<unit> or N <unit>, e.g. "90g", "1,5 kg", "250 ml".
// The negative lookbehind (?<![0-9\-]) prevents matching the upper bound of a
// baby-size range like "11-16 kg" — the "16" is preceded by "-", so it is skipped.
const SINGLE_WEIGHT_RE = new RegExp(
  `(?<![0-9\\-])${NUM_PAT}\\s*${WEIGHT_UNIT_PAT}\\b`,
  "i",
);

// Strips baby wearer-weight labels like "T5 17 kg" or "talla 5 18 kg".
// These describe the baby's body weight (size indicator), not the product weight.
// Range forms "T5 11-16 kg" are NOT matched (the number before "-" stops the match)
// so they fall through safely to the SINGLE_WEIGHT_RE negative-lookbehind.
const TALLA_WEIGHT_RE = /\b(?:T\d+\+?|talla\s+\d+\+?)\s+\d+\s*kg\b/gi;

// Unit count: "44 uds", "44 unidades", "44 pañales", "42 UNID."
const UNIT_COUNT_RE =
  /(\d+)\s*(uds?\.?|und\w*|unid\.?|unidades?|pa[nñ]ales)\b/i;

// Inline multiply without unit: "3x44" (counted items)
const INLINE_MULT_RE = /(\d+)[x×](\d+)/i;

// Spaced multiply without unit: "3 x 44" (counted items)
const SPACED_MULT_RE = /(\d+)\s+[x×]\s+(\d+)/i;

/* eslint-enable sonarjs/slow-regex */

function normalizeToBaseUnit(
  value: number,
  unit: string,
): { netWeight: number; netWeightUnit: NetWeightUnit } {
  switch (unit.toLowerCase()) {
    case "kg":
      return { netWeight: Math.round(value * 1000), netWeightUnit: "g" };
    case "g":
    case "gr":
      return { netWeight: Math.round(value), netWeightUnit: "g" };
    case "mg":
      return { netWeight: Math.round(value / 1000), netWeightUnit: "g" };
    case "l":
      return { netWeight: Math.round(value * 1000), netWeightUnit: "ml" };
    case "cl":
      return { netWeight: Math.round(value * 10), netWeightUnit: "ml" };
    default: // ml
      return { netWeight: Math.round(value), netWeightUnit: "ml" };
  }
}

function parseNum(s: string): number {
  return Number.parseFloat(s.replace(",", "."));
}

/**
 * Extract package quantity, weight and/or volume from a product name.
 *
 * Examples:
 *   "Atún 3x80g"         → { packageSize: 3, netWeight: 80, netWeightUnit: 'g' }
 *   "Leche 1,5L"         → { netWeight: 1500, netWeightUnit: 'ml' }
 *   "Pañales T5 44 uds"  → { packageSize: 44 }
 *   "Yogur 125g"         → { netWeight: 125, netWeightUnit: 'g' }
 *   "Refresco 6x33cl"    → { packageSize: 6, netWeight: 330, netWeightUnit: 'ml' }
 *
 * Priority: keyword unit counts ("44 uds", "42 UNID.", ...) beat weight extraction.
 * This prevents baby-size weight labels from overriding explicit unit counts.
 */
export function parseProductQuantity(name: string): ParsedQuantity {
  // Keyword unit counts are unambiguous — try them first so that product names
  // like "DODOT T5 17 KG 42 UNID." correctly return {packageSize: 42} rather
  // than {netWeight: 17000} just because the weight appeared first in the string.
  return (
    tryParseKeywordUnitCount(name) ??
    tryParseWeightQuantity(name) ??
    tryParseUnitMultiply(name) ??
    {}
  );
}

/** Try to extract weight/volume — handles multi-pack×weight and single weight. */
function tryParseWeightQuantity(name: string): ParsedQuantity | null {
  // Remove baby wearer-weight labels ("T5 17 kg", "T5+ (16 kg)") before trying
  // to extract product weight. These labels describe the baby's body weight (size
  // indicator), not the weight of the product itself.
  const cleaned = name.replace(TALLA_WEIGHT_RE, " ").trim();

  const mw = MULTI_WEIGHT_RE.exec(cleaned);
  if (mw) {
    const count = Math.round(parseNum(mw[1] ?? "1"));
    const normalized = normalizeToBaseUnit(
      parseNum(mw[2] ?? "0"),
      mw[3] ?? "g",
    );
    return count >= 2 ? { packageSize: count, ...normalized } : normalized;
  }
  const sw = SINGLE_WEIGHT_RE.exec(cleaned);
  if (sw) {
    return normalizeToBaseUnit(parseNum(sw[1] ?? "0"), sw[2] ?? "g");
  }
  return null;
}

/** Try to extract a keyword-based unit count: "44 uds", "42 UNID.", "42 pañales". */
function tryParseKeywordUnitCount(name: string): ParsedQuantity | null {
  const uc = UNIT_COUNT_RE.exec(name);
  if (uc) return { packageSize: Number.parseInt(uc[1] ?? "0", 10) };
  return null;
}

/** Try to extract a unit count via multiply notation: "3x44", "3 x 44". */
function tryParseUnitMultiply(name: string): ParsedQuantity | null {
  return (
    tryMultiplyCount(INLINE_MULT_RE.exec(name)) ??
    tryMultiplyCount(SPACED_MULT_RE.exec(name))
  );
}

function tryMultiplyCount(m: RegExpExecArray | null): ParsedQuantity | null {
  if (!m) return null;
  const left = Number.parseInt(m[1] ?? "0", 10);
  const right = Number.parseInt(m[2] ?? "0", 10);
  if (left >= 2 && left <= 9 && right >= 20 && right <= 250) {
    return { packageSize: left * right };
  }
  return null;
}

/**
 * Parse a Spanish price string (e.g. "12,99 €") to a float.
 * Returns NaN if parsing fails.
 */
export function parseSpanishPrice(raw: string): number {
  return Number.parseFloat(raw.replace(/[^\d,]/g, "").replace(",", "."));
}

/** Parse the refresh URL from an Akamai bot-challenge meta-refresh page. */
function parseMetaRefreshUrl(html: string, baseOrigin: string): string | null {
  // Akamai sends: <meta http-equiv="refresh" content="5; URL='/path?bm-verify=...'" />
  const match = /content="\d+;\s*URL='([^']+)'"/i.exec(html);
  if (!match) return null;
  const raw = match[1].replace(/&amp;/g, "&");
  return raw.startsWith("http") ? raw : `${baseOrigin}${raw}`;
}

/**
 * Fetch HTML using Chrome TLS + header fingerprint emulation via impit.
 * Automatically follows a single Akamai bot-challenge meta-refresh redirect
 * (identified by a short response containing a bm-verify token in the URL).
 * Returns null on any error (network, non-2xx, etc.).
 */
export async function fetchHtml(
  url: string,
  timeoutMs = 10_000,
): Promise<string | null> {
  try {
    const response = await browserClient.fetch(url, { timeout: timeoutMs });
    if (!response.ok) return null;
    const html = await response.text();

    // Short placeholder pages (~2-3 KB) with a meta-refresh are Akamai challenges.
    // Follow the redirect once with the bm-verify token to get the real page.
    if (html.length < 10_000 && html.includes("bm-verify")) {
      const { origin } = new URL(url);
      const redirectUrl = parseMetaRefreshUrl(html, origin);
      if (redirectUrl) {
        await new Promise<void>((r) => setTimeout(r, 500));
        const resp2 = await browserClient.fetch(redirectUrl, {
          timeout: timeoutMs,
        });
        return resp2.ok ? resp2.text() : null;
      }
    }

    return html;
  } catch {
    return null;
  }
}
