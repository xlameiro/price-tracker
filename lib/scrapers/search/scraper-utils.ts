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
 * Legacy helper — prefer {@link parseProductQuantity} for all new code.
 * `parseProductQuantity` extracts both weight and unit count in a single pass
 * and handles all modern multi-pack formats.
 *
 * Extract the number of units in a pack from a product name.
 * e.g. "Pañales Dodot 44 unidades" → 44, "Dodot T5 42 uds" → 42
 * Handles multi-pack formats: "2 x 44" → 88, "3x48 uds" → 144
 * Input is internal scraped data (not user-controlled).
 *
 * @deprecated Use {@link parseProductQuantity} instead — it returns the full
 * `ParsedQuantity` struct (packageSize + netWeight + netWeightUnit) and is used
 * by all active scrapers. This function exists only for backwards compatibility.
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
// (so "kg" beats "g", "ml" beats "l", "cl" beats "l"; "litros?" before "l" for
// Spanish full-word forms like "1 litro", "1,5 litros")
const WEIGHT_UNIT_PAT = "(litros?|kg|ml|cl|gr|mg|g|l)";
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

// Unit count — generic consumer: "44 uds", "44 unidades", "44 pañales", "42 UNID.", "4u", "4 u."
// u(?:ds?)? matches: u, ud, uds (bare "u" added for compact Spanish notation like "4u").
// Negative lookbehind (?<![x×\d]) anchors the start of the digit run: prevents matching
// mid-number suffixes ("8u" inside "6x48u") by requiring the digit is NOT preceded by x, ×,
// or another digit — effectively requiring the number starts here, not inside a multiply pattern.
const UNIT_COUNT_GENERIC_RE =
  /(?<![x×\d])(\d+)\s*(u(?:ds?)?\.?|unid\.?|unidades?|pa[nñ]ales)\b/i;

// "Pack de N" / "pack N" notation common in Spanish supermarkets
const PACK_DE_RE = /\bpack\s+(?:de?\s+)?(\d+)\b/i;

// Inline multiply without unit: "3x44" (counted items)
const INLINE_MULT_RE = /(\d+)[x×](\d+)/i;

// Spaced multiply without unit: "3 x 44" (counted items)
const SPACED_MULT_RE = /(\d+)\s+[x×]\s+(\d+)/i;

// x-prefix pack size modifier, optionally separated from weight: "x4 125g", "x4"
// Used by some retailers (e.g. Amazon.es) to signal a multipack count.
const XPREFIX_PACK_RE = /\b[x×](\d+)\b/i;

/* eslint-enable sonarjs/slow-regex */

// Pharmacy/dosage and counted-unit keywords checked via a Set to avoid regex
// complexity. Avoids `sonarjs/regex-complexity` limit triggered by long alternation.
const PHARMACY_UNIT_KEYWORDS = new Set([
  "cápsula",
  "cápsulas",
  "capsula",
  "capsulas",
  "comprimido",
  "comprimidos",
  "pastilla",
  "pastillas",
  "sobre",
  "sobres",
  "ampolla",
  "ampollas",
  "tableta",
  "tabletas",
  "dosis",
  "lavado",
  "lavados",
  // Paper and household counted units
  "rollo",
  "rollos",
  "paquete",
  "paquetes",
  "hoja",
  "hojas",
  // Wipes — toallitas are counted like diapers, not measured by weight
  "toallita",
  "toallitas",
]);

// Container words whose count is a meaningful pack size and that may also carry
// a per-container weight/volume (e.g. "6 latas 33cl", "4 bricks 200ml").
const CONTAINER_KEYWORDS = new Set([
  "lata",
  "latas",
  "botella",
  "botellas",
  "brick",
  "bricks",
  "brik",
  "briks",
  "bote",
  "botes",
]);

// Set of keywords that represent individual countable units (not weight/volume).
// Used by tryParseUnitCountMultiply to distinguish unit-count multiplications
// (e.g. "3 x 48 uds") from weight multiplications (e.g. "3 x 80g").
const UNIT_MULT_KEYWORDS = new Set([
  "uds",
  "ud",
  "unidades",
  "unidad",
  "pañales",
  "panales",
  "toallitas",
  "toallita",
]);

// Words that signal the outer-pack multiplier in "N pack M uds" naming patterns.
const PACK_MULTIPLIER_WORDS = new Set(["pack", "packs", "paquete", "paquetes"]);

/* eslint-disable sonarjs/slow-regex */

// "N × M <unit_keyword>" — requires whitespace-separated keyword token so that
// weight patterns like "3 x 80g" (unit="g", not a count keyword) fall through.
const UNIT_MULT_EXPLICIT_RE = /(\d+)\s*[x×]\s*(\d+)\s+(\S+)/i;

// Compact "48uds" or "6u" token: digit directly followed by a unit suffix.
// Used to split such tokens before the token-scan in tryParseUnitCountMultiply.
const COMPACT_UNIT_RE = /^(\d+)(uds?\.?|u\.?)$/i;

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
    case "litro":
    case "litros":
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
    tryParseUnitCountMultiply(name) ??
    tryParsePackDeN(name) ??
    tryParseKeywordUnitCount(name) ??
    tryParseContainerCount(name) ??
    tryParseKeywordPharmacy(name) ??
    tryParseWeightQuantity(name) ??
    tryParseUnitMultiply(name) ??
    {}
  );
}

/**
 * Try to extract a multiplied unit count from multi-pack naming patterns:
 *   "3 x 48 uds."       → { packageSize: 144 }   (explicit × notation)
 *   "Pack 6 x 48 uds"   → { packageSize: 288 }   (pack prefix + explicit ×)
 *   "6 paquetes 48uds"  → { packageSize: 288 }   (token scan, compact suffix)
 *   "48 uds. pack 6"    → { packageSize: 288 }   (reversed order)
 *
 * Safety: only fires when the unit keyword is a counted-item keyword (uds, pañales…),
 * NOT a weight unit (g, ml, kg). This ensures "3 x 80g" falls through to the
 * weight parser instead of being read as 240 units.
 */
function tryParseUnitCountMultiply(name: string): ParsedQuantity | null {
  return tryExplicitUnitMultiply(name) ?? tryTokenScanMultiply(name);
}

// Pattern 1: explicit "N × M <unit_keyword>" — whitespace before keyword token required
// so "3 x 80g" (no space between "80" and "g") never triggers.
function tryExplicitUnitMultiply(name: string): ParsedQuantity | null {
  const em = UNIT_MULT_EXPLICIT_RE.exec(name);
  if (!em) return null;
  const keyword = (em[3] ?? "").toLowerCase().replace(/\.$/, "");
  if (!UNIT_MULT_KEYWORDS.has(keyword)) return null;
  return {
    packageSize:
      Number.parseInt(em[1] ?? "0", 10) * Number.parseInt(em[2] ?? "0", 10),
  };
}

// Pattern 2: token scan for "N pack M uds", "M uds pack N", "N paquetes Muds" forms.
function tryTokenScanMultiply(name: string): ParsedQuantity | null {
  const tokens = expandCompactUnitTokens(name);
  const counts = extractPackAndUdsCounts(tokens);
  if (counts === null) return null;
  // When udsCount is already very large it represents the pack total, not a per-box count.
  // e.g. "Pack 2 cajas 1728 uds" → 1728 is the total (2×864), not 2×1728 = 3456.
  // Threshold 500 exceeds any realistic single retail unit count in the Spanish market.
  if (counts.udsCount > 500) return { packageSize: counts.udsCount };
  return { packageSize: counts.packCount * counts.udsCount };
}

// Split tokens like "48uds" → ["48", "uds"] so compact suffixes are recognised.
function expandCompactUnitTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .flatMap((tok) => {
      const cm = COMPACT_UNIT_RE.exec(tok);
      return cm ? [cm[1] ?? "", cm[2] ?? ""] : [tok];
    });
}

function extractPackAndUdsCounts(
  tokens: string[],
): { packCount: number; udsCount: number } | null {
  let packCount: number | null = null;
  let udsCount: number | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? "";
    const next = tokens[i + 1] ?? "";
    if (/^\d+$/.test(tok)) {
      const count = Number.parseInt(tok, 10);
      const kw = next.endsWith(".") ? next.slice(0, -1) : next;
      ({ packCount, udsCount } = classifyCount(kw, count, packCount, udsCount));
    }
    // Also handle keyword-before-number: "pack 6" where the digit follows the word
    if (PACK_MULTIPLIER_WORDS.has(tok) && /^\d+$/.test(next)) {
      const count = Number.parseInt(next, 10);
      if (count >= 2 && count <= 12) packCount = count;
    }
  }
  if (packCount !== null && udsCount !== null) return { packCount, udsCount };
  return null;
}

function classifyCount(
  kw: string,
  count: number,
  packCount: number | null,
  udsCount: number | null,
): { packCount: number | null; udsCount: number | null } {
  if (PACK_MULTIPLIER_WORDS.has(kw) && count >= 2 && count <= 12)
    return { packCount: count, udsCount };
  if (UNIT_MULT_KEYWORDS.has(kw) && count >= 10)
    return { packCount, udsCount: count };
  return { packCount, udsCount };
}

/** Try to extract a weight/volume — handles multi-pack×weight and single weight. */
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

  // Handle "x4 125g" / "x4125g" — x-prefix pack count followed by weight.
  const xp = XPREFIX_PACK_RE.exec(cleaned);
  const sw = SINGLE_WEIGHT_RE.exec(cleaned);
  if (xp && sw) {
    const packSize = Number.parseInt(xp[1] ?? "1", 10);
    const normalized = normalizeToBaseUnit(
      parseNum(sw[1] ?? "0"),
      sw[2] ?? "g",
    );
    return packSize >= 2
      ? { packageSize: packSize, ...normalized }
      : normalized;
  }

  if (sw) {
    return normalizeToBaseUnit(parseNum(sw[1] ?? "0"), sw[2] ?? "g");
  }
  return null;
}

/**
 * Try to extract a pack count from "Pack de N" / "pack N" notation.
 * Also enriches the result with per-unit weight/volume when the name contains
 * both a pack indicator and a weight pattern (e.g. "pack 4 x 125g",
 * "Pack de 6 botellas 1,5L"). Without this, "pack 4 x 125g" would lose the
 * 125g and be compared by unit count instead of by per-100g.
 */
function tryParsePackDeN(name: string): ParsedQuantity | null {
  const m = PACK_DE_RE.exec(name);
  if (!m) return null;
  const packageSize = Number.parseInt(m[1] ?? "0", 10);
  const weight = tryParseWeightQuantity(name);
  return { packageSize, ...weight };
}

/**
 * Try to extract a container-based pack count with optional per-container weight.
 *
 * Handles "N <container> [weight]" patterns where the container word signals that
 * N is the number of units and there may also be a per-unit weight/volume.
 * Requires N >= 2 to avoid treating single items as packs.
 *
 * Examples:
 *   "6 latas cerveza 33cl"   → { packageSize: 6, netWeight: 330, netWeightUnit: 'ml' }
 *   "6 botellas agua 500ml"  → { packageSize: 6, netWeight: 500, netWeightUnit: 'ml' }
 *   "4 bricks leche 200ml"   → { packageSize: 4, netWeight: 200, netWeightUnit: 'ml' }
 *   "3 botes tomate 400g"    → { packageSize: 3, netWeight: 400, netWeightUnit: 'g' }
 *   "1 botella 500ml"        → null (single item — falls through to weight parser)
 */
function tryParseContainerCount(name: string): ParsedQuantity | null {
  const tokens = name.toLowerCase().split(/\s+/);
  for (let i = 0; i < tokens.length - 1; i++) {
    const countToken = tokens[i];
    if (!/^\d+$/.test(countToken)) continue;
    const count = Number.parseInt(countToken, 10);
    if (count < 2) continue;
    const raw = tokens[i + 1] ?? "";
    const keyword = raw.endsWith(".") ? raw.slice(0, -1) : raw;
    if (!CONTAINER_KEYWORDS.has(keyword)) continue;
    // Container matched — also extract per-container weight/volume if present.
    const weight = tryParseWeightQuantity(name);
    return { packageSize: count, ...weight };
  }
  return null;
}

/**
 * Try to extract a keyword-based unit count: "44 uds", "42 UNID.", "42 pañales".
 * Also enriches the result with per-unit weight/volume when the weight appears
 * AFTER the unit count in the string — weight-after = per-unit weight.
 * When weight appears BEFORE the unit count, it describes the total pack weight
 * (e.g. "Queso 150g 8 ud." = 150g total for 8 slices, not 8×150g).
 * Baby-size weight labels ("T5 17 kg") are stripped by tryParseWeightQuantity before
 * extraction, so diapers remain safe ("DODOT T5 17 KG 42 UNID." → {packageSize:42}).
 */
function tryParseKeywordUnitCount(name: string): ParsedQuantity | null {
  const m = UNIT_COUNT_GENERIC_RE.exec(name);
  if (!m) return null;
  const packageSize = Number.parseInt(m[1] ?? "0", 10);

  const mwIdx = MULTI_WEIGHT_RE.exec(name)?.index ?? Infinity;
  const swIdx = SINGLE_WEIGHT_RE.exec(name)?.index ?? Infinity;
  const weightIdx = Math.min(mwIdx, swIdx);

  const weight = tryParseWeightQuantity(name);
  // Liquid products (ml): volume is always per individual container — spread regardless
  // of position ("33cl 6 unidades" means 6 × 33cl cans, not 33cl split across 6).
  // Solid products (g): weight-before-count = total pack weight (e.g. "150g 8 ud.").
  const shouldSpread = weight?.netWeightUnit === "ml" || weightIdx > m.index;
  return shouldSpread ? { packageSize, ...weight } : { packageSize };
}

/**
 * Try to extract a pharmacy/dosage unit count by scanning token pairs.
 * Uses a Set lookup instead of a complex regex alternation to stay within the
 * sonarjs/regex-complexity limit.
 *
 * Examples: "28 cápsulas", "40 comprimidos", "30 lavados"
 */
function tryParseKeywordPharmacy(name: string): ParsedQuantity | null {
  const tokens = name.toLowerCase().split(/\s+/);
  for (let i = 0; i < tokens.length - 1; i++) {
    const countToken = tokens[i];
    if (!/^\d+$/.test(countToken)) continue;
    const raw = tokens[i + 1] ?? "";
    const keyword = raw.endsWith(".") ? raw.slice(0, -1) : raw;
    if (PHARMACY_UNIT_KEYWORDS.has(keyword)) {
      return { packageSize: Number.parseInt(countToken, 10) };
    }
  }
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
  // Allow up to 24 outer-packs for bulk purchases (e.g. "18 x 48" = 864 wipes).
  if (left >= 2 && left <= 24 && right >= 20 && right <= 250) {
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
