import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Carrefour uses Empathy.co as its search engine. The API is publicly
// accessible at api.empathy.co and bypasses Cloudflare WAF entirely.
//
// Quantity extraction: Empathy returns structured fields per product:
//   unit_conversion_factor: 1.5  (numeric quantity in measure_unit's unit)
//   unit_short_name: "l" | "ud" | "ml" | "cl" | "kg" | "g"
//   measure_unit: same as unit_short_name (alternate field)
//   recipient: "1,5 l." (human-readable — not parsed directly)
// These are used in preference to regex-based product name parsing.
const EMPATHY_API = "https://api.empathy.co/search/v1/query/carrefour/search";

type EmpathyItem = {
  display_name?: string;
  active_price?: number;
  urls?: { food?: string; nonFood?: string };
  image_path?: { food?: string; nonFood?: string };
  product_id?: string;
  /** Numeric product quantity in unit_short_name units — e.g. 1.5 for 1.5 l, 56 for 56 ud */
  unit_conversion_factor?: number;
  /** Unit for unit_conversion_factor: "ud", "l", "ml", "cl", "kg", "g" */
  unit_short_name?: string;
  /** Same as unit_short_name; included as a fallback */
  measure_unit?: string;
};

type EmpathyResponse = {
  catalog?: { content?: EmpathyItem[] };
};

type QuantityFields = Pick<
  SearchResult,
  "packageSize" | "netWeight" | "netWeightUnit"
>;

// Lookup table for weight/volume unit conversions (factor → grams or millilitres).
// Carrefour's Empathy API sometimes returns very small factor values (e.g. 0.001 kg)
// as placeholders for variable-weight products; the <10 guard below catches these.
const CARREFOUR_WEIGHT_UNITS: Readonly<
  Record<string, { multiplier: number; unit: "g" | "ml" }>
> = {
  g: { multiplier: 1, unit: "g" },
  kg: { multiplier: 1000, unit: "g" },
  ml: { multiplier: 1, unit: "ml" },
  cl: { multiplier: 10, unit: "ml" },
  l: { multiplier: 1000, unit: "ml" },
};

/**
 * Resolve quantity from Empathy.co structured fields.
 * Falls back to regex-based name parsing when structured fields are absent.
 * Exported for unit testing.
 */
export function resolveCarrefourQuantity(
  item: EmpathyItem,
): Partial<QuantityFields> {
  const factor = item.unit_conversion_factor;
  const unit = (item.unit_short_name ?? item.measure_unit ?? "").toLowerCase();
  const fallback = (): Partial<QuantityFields> =>
    parseProductQuantity(item.display_name ?? "");

  if (!factor || !unit) return fallback();
  if (unit === "ud" || unit === "uds")
    return { packageSize: Math.round(factor) };

  const conv = CARREFOUR_WEIGHT_UNITS[unit];
  if (!conv) return fallback();

  const amount = Math.round(factor * conv.multiplier);
  if (amount < 10) return fallback();
  return { netWeight: amount, netWeightUnit: conv.unit };
}

export class CarrefourSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "carrefour";
  readonly storeName = "Carrefour";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = new URL(EMPATHY_API);
      url.searchParams.set("query", query);
      url.searchParams.set("lang", "es");
      url.searchParams.set("rows", "5");
      url.searchParams.set("start", "0");
      url.searchParams.set("scope", "desktop");

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [];

      const data = (await response.json()) as EmpathyResponse;
      const items = data.catalog?.content ?? [];

      return items.slice(0, 5).flatMap((item) => {
        const productName = item.display_name;
        const price = item.active_price;
        if (!productName || !price) return [];

        const urlPath = item.urls?.food ?? item.urls?.nonFood ?? "";
        // Empathy sometimes returns a category listing URL (ends with /c).
        // Fall back to the search page so the link is always product-specific.
        const productUrl =
          urlPath && !urlPath.endsWith("/c")
            ? `https://www.carrefour.es${urlPath}`
            : `https://www.carrefour.es/supermercado/buscar/q=${encodeURIComponent(productName)}`;
        // static.carrefour.es is behind Cloudflare Bot Management.
        // Browser <img> fetches are allowed — use unoptimized: true via getImageSrc.
        const imageUrl =
          item.image_path?.food ?? item.image_path?.nonFood ?? null;

        return [
          {
            storeSlug: "carrefour",
            storeName: "Carrefour",
            productName,
            price,
            currency: "EUR",
            imageUrl,
            productUrl,
            isAvailable: true,
            ...resolveCarrefourQuantity(item),
          } satisfies SearchResult,
        ];
      });
    } catch {
      return [];
    }
  }
}
