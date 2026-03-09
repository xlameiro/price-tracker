/**
 * Normalises a string: lowercase, strip diacritics, collapse non-alphanumeric
 * characters into spaces.
 */
function normaliseStr(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common Spanish stop-words that carry no discriminating value.
// "panales" is omitted because every product in this app is pañales — it adds
// no discriminating power and only wastes a match slot.
// "talla" is omitted because the size NUMBER is already strictly checked as a
// whole-word; keeping "talla" would let it absorb a failure slot and allow
// a wrong size to still pass.
const STOP_WORDS = new Set([
  "de",
  "la",
  "el",
  "en",
  "y",
  "a",
  "los",
  "las",
  "del",
  "con",
  "por",
  "un",
  "una",
  "es",
  "al",
  "se",
  "que",
  "para",
  "pack",
  "uds",
  "unidades",
  // product-category words — generic in this app
  "panales",
  "talla",
]);

/**
 * Returns true when productName is a close enough match to query.
 *
 * Rules:
 * - Digits in the query (e.g. "5" in "talla 5") must appear in the product
 *   name either as a standalone number OR as the size-code suffix ("T5", "t5").
 *   "54" does NOT satisfy a search for "5".
 * - At least 80 % of the remaining non-stop-word tokens must be present in
 *   the product name. With the stop-word set above, typical diaper queries
 *   produce 3 tokens (brand + model + size-number), so this effectively
 *   requires ALL tokens to be present — preventing e.g. "Dodot Baby Dry T5"
 *   (missing the "sensitive" model token) from matching a Sensitive search.
 */
export function isRelevant(productName: string, query: string): boolean {
  const normQuery = normaliseStr(query);
  const normName = normaliseStr(productName);

  // Preserve hyphens for the size-number check so ranges like "(2-5 kg)" and
  // "5-10 kg" are never confused with a standalone size "5".
  const rawLower = productName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Keep numeric tokens regardless of length — single-digit sizes like "5"
  // would otherwise be dropped by the `length >= 2` guard.
  const tokens = normQuery
    .split(" ")
    .filter((t) =>
      /^\d+$/.test(t) ? true : t.length >= 2 && !STOP_WORDS.has(t),
    );

  if (tokens.length === 0) return true;

  // ── Strict size-number check ─────────────────────────────────────────────
  // Each numeric token (e.g. "5") must appear in the ORIGINAL name either as
  // a standalone number or as a T-code prefix ("T5"), NOT inside a weight range.
  //
  // Both the leading AND trailing character classes exclude "-" so that:
  //   "(2-5 kg)"  →  "5" preceded by "-"  →  no match  →  FAIL ✓
  //   "(5-10 kg)" →  "5" followed by "-"  →  no match  →  FAIL ✓
  //   "52 ud"     →  "5" followed by "2"  →  no match  →  FAIL ✓
  //   "Talla 5"   →  "5" surrounded by spaces  →  PASS ✓
  //   "T5"        →  t-prefixed, surrounded by spaces  →  PASS ✓
  const numbers = tokens.filter((t) => /^\d+$/.test(t));
  for (const num of numbers) {
    const sizePattern = new RegExp(`(?:^|[^0-9-])t?${num}(?:[^0-9-]|$)`, "i");
    if (!sizePattern.test(rawLower)) return false;
  }

  // ── Fuzzy word-token check ────────────────────────────────────────────────
  // Non-numeric tokens (brand, model) use substring matching at 80%.
  // Numeric tokens are excluded — they were already strictly validated above.
  const words = tokens.filter((t) => !/^\d+$/.test(t));
  if (words.length === 0) return true;

  const matched = words.filter((t) => normName.includes(t));
  return matched.length / words.length >= 0.8;
}
