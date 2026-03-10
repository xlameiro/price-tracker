import type { ParsedQuantity } from "./scraper-utils";
import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// tienda.froiz.com (old domain) is dead. Results come from the Empathy.co search API.
// The API returns structured quantity fields: measurementUnit + measurementUnitRatio.
type EmpathyItem = {
  __name?: string;
  __prices?: { current?: { value?: number } };
  imageUrl?: string;
  slug?: string;
  id?: string;
  measurementUnit?: string;
  measurementUnitRatio?: number;
};
type EmpathyResponse = { catalog?: { content?: EmpathyItem[] } };

/**
 * Resolve package size / net weight from Froiz Empathy.co structured fields.
 * Falls back to name-based parsing when the structured fields are missing.
 *
 * Field mapping:
 *   measurementUnit="Litro"     → netWeight (ml)  e.g. 1.5 → 1500 ml
 *   measurementUnit="Unidad"    → packageSize      e.g. 58
 *   measurementUnit="Kilogramo" → netWeight (g)    e.g. 0.2 → 200 g
 */
export function resolveFroizQuantity(item: EmpathyItem): ParsedQuantity {
  const unit = item.measurementUnit?.toLowerCase();
  const ratio = item.measurementUnitRatio;

  if (!unit || !ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return parseProductQuantity(item.__name ?? "");
  }

  if (unit === "litro") {
    return { netWeight: Math.round(ratio * 1000), netWeightUnit: "ml" };
  }
  if (unit === "unidad") {
    return { packageSize: Math.round(ratio) };
  }
  if (unit === "kilogramo") {
    return { netWeight: Math.round(ratio * 1000), netWeightUnit: "g" };
  }

  // Unknown unit — fall back to name parsing
  return parseProductQuantity(item.__name ?? "");
}

export class FroizSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "froiz";
  readonly storeName = "Froiz";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    // Drop diacritics — Empathy.co returns 0 results for queries containing ñ.
    const normalisedQuery = query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Empathy.co uses strict AND-matching. If the full query includes a size
    // that Froiz doesn't carry (e.g. "Talla 5"), it returns 0. Fall back to
    // progressively shorter queries by dropping words from the end.
    const words = normalisedQuery.trim().split(/\s+/);
    for (let end = words.length; end >= 2; end--) {
      const q = words.slice(0, end).join(" ");
      const items = await this.fetchItems(q);
      if (items.length > 0) return items.slice(0, 5);
    }
    return [];
  }

  private async fetchItems(query: string): Promise<SearchResult[]> {
    const url = `https://api.empathy.co/search/v1/query/froiz/search?internal=true&query=${encodeURIComponent(query)}&origin=url%3Aexternal&start=0&rows=10&instance=froiz&scope=desktop&lang=es&currency=EUR`;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [];

      const data = (await response.json()) as EmpathyResponse;
      const items = data.catalog?.content ?? [];

      return items.slice(0, 5).flatMap((item) => {
        const productName = item.__name;
        const price = item.__prices?.current?.value;
        if (!productName || !price || !Number.isFinite(price) || price <= 0)
          return [];

        const slug = item.slug ?? item.id ?? "";
        return [
          {
            storeSlug: this.storeSlug,
            storeName: this.storeName,
            productName,
            price,
            currency: "EUR",
            imageUrl: item.imageUrl ?? null,
            productUrl: `https://supermercado.froiz.com/product/${slug}`,
            isAvailable: true,
            ...resolveFroizQuantity(item),
          } satisfies SearchResult,
        ];
      });
    } catch {
      return [];
    }
  }
}
