/**
 * Shared price-comparison engine used by both the search results page and the
 * product-detail price-ranking table.
 *
 * Terminology
 * ───────────
 * packageSize   – number of individual items in the pack (e.g. 44 diapers)
 * netWeight     – grams or millilitres of a single item
 * netWeightUnit – 'g' | 'ml'
 *
 * Comparison modes
 * ────────────────
 * per100g   – €/kg     (dry/solid food, hygiene products sold by weight)
 * per100ml  – €/l      (liquids: milk, oil, drinks)
 * perUnit   – €/unit   (discrete items: diapers, cans, wipes)
 * rawPrice  – pack price with no normalisation (fallback)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComparisonMode = "per100g" | "per100ml" | "perUnit" | "rawPrice";

/**
 * Minimum shape required for all comparison helpers.
 * Both `SearchResult` (scraper) and `PriceRow` (DB read model) satisfy this.
 */
export interface ComparableItem {
  price: number;
  subscribePrice?: number | null;
  packageSize?: number | null;
  netWeight?: number | null;
  netWeightUnit?: "g" | "ml" | null;
  /** Shipping cost in EUR (0 = free; null = unknown) */
  shippingCost?: number | null;
}

export const COMPARISON_HEADER: Readonly<Record<ComparisonMode, string>> = {
  per100g: "€/kg",
  per100ml: "€/l",
  perUnit: "€/ud",
  rawPrice: "€/pack",
};

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Effective purchase price, optionally including shipping cost.
 * Uses subscribePrice when available (Subscribe & Save / recurring delivery).
 */
export function effectivePrice(
  item: ComparableItem,
  includeShipping = false,
): number {
  const base = item.subscribePrice ?? item.price;
  if (!includeShipping) return base;
  return base + (item.shippingCost ?? 0);
}

/**
 * Detect the best comparison unit from the available row data.
 *
 * Uses majority vote: picks the mode that covers the most items.
 * Ties are broken by: per100g > per100ml > perUnit > rawPrice.
 * This prevents a small number of mis-parsed entries from overriding
 * the correct mode used by the majority of stores.
 */
export function inferComparisonMode(items: ComparableItem[]): ComparisonMode {
  let gCount = 0;
  let mlCount = 0;
  let unitOnlyCount = 0;

  for (const item of items) {
    if (item.netWeightUnit === "g") gCount++;
    else if (item.netWeightUnit === "ml") mlCount++;
    else if (item.packageSize != null) unitOnlyCount++;
  }

  const max = Math.max(gCount, mlCount, unitOnlyCount);
  if (max === 0) return "rawPrice";
  if (gCount === max) return "per100g";
  if (mlCount === max) return "per100ml";
  return "perUnit";
}

/**
 * Normalised comparable price for a single item under a given mode.
 *
 * Returns `null` when the item lacks the data required for the mode —
 * callers should sort nulls to the bottom and display "—".
 *
 * @param includeShipping  When true, adds shippingCost to the base price
 *                         before computing the per-unit ratio.
 */
export function comparablePrice(
  item: ComparableItem,
  mode: ComparisonMode,
  includeShipping = false,
): number | null {
  const base = effectivePrice(item, includeShipping);

  switch (mode) {
    case "per100g":
    case "per100ml": {
      if (item.netWeight == null || item.netWeight <= 0) return null;
      const totalWeight = (item.packageSize ?? 1) * item.netWeight;
      return (base / totalWeight) * 1000;
    }
    case "perUnit":
      // Avoid dividing by 1 when packageSize is unknown — it would show the
      // full pack price as a per-unit price, which misleads the user.
      if (item.packageSize == null) return null;
      return base / item.packageSize;
    case "rawPrice":
      return base;
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable weight/volume string.
 * Converts to larger units when appropriate: g→kg at 1000g, ml→L at 1000ml.
 */
export function formatWeight(value: number, unit: "g" | "ml"): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);

  if (unit === "g") {
    return value >= 1000 ? `${fmt(value / 1000)} kg` : `${value}g`;
  }
  return value >= 1000 ? `${fmt(value / 1000)} L` : `${value} ml`;
}

/**
 * Concise quantity label shown next to the unit price in cards and table rows.
 *
 * Examples: "44 uds", "6×330 ml", "1.5 L", "500g"
 */
export function quantityLabel(item: ComparableItem): string {
  if (item.netWeight != null && item.netWeightUnit != null) {
    const weightStr = formatWeight(item.netWeight, item.netWeightUnit);
    return item.packageSize != null && item.packageSize > 1
      ? `${item.packageSize}×${weightStr}`
      : weightStr;
  }
  if (item.packageSize != null) {
    return `${item.packageSize} uds`;
  }
  return "—";
}

/**
 * Sort comparator for an array of ComparableItems.
 *
 * Items with a computable unit price are sorted ascending; items where the
 * unit price cannot be computed (null) are placed last and sorted by raw price.
 */
export function compareByUnitPrice(
  a: ComparableItem,
  b: ComparableItem,
  mode: ComparisonMode,
  includeShipping = false,
): number {
  const ca = comparablePrice(a, mode, includeShipping);
  const cb = comparablePrice(b, mode, includeShipping);

  if (ca !== null && cb !== null) return ca - cb;
  if (ca === null && cb === null) {
    return (
      effectivePrice(a, includeShipping) - effectivePrice(b, includeShipping)
    );
  }
  return ca === null ? 1 : -1;
}

/**
 * Format a price value for the comparison column.
 * Returns a locale-formatted EUR string (3 decimal places for per-unit values
 * to distinguish e.g. 0.409 vs 0.412 €/pañal, 2 for heavier weights).
 */
export function formatComparablePrice(
  value: number,
  mode: ComparisonMode,
): string {
  const decimals = mode === "perUnit" ? 3 : 2;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
