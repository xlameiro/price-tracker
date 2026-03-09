import { extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// viandvi.com is gone. The live store is viandvi.es (WooCommerce).
// The search results page doesn't show prices, so we use the WooCommerce Store REST API.
type WcProduct = {
  name?: string;
  prices?: { price?: string; currency_minor_unit?: number };
  permalink?: string;
  images?: Array<{ src?: string }>;
  // WooCommerce Store API v1 availability fields
  is_in_stock?: boolean;
  on_backorder?: boolean;
};

export class ViandviSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "viandvi";
  readonly storeName = "Via&Vi";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    // The WooCommerce Store API does substring matching on the full query string.
    // If the query starts with a generic category word (e.g. "Pañales") that
    // doesn't appear at the start of product names, the full query returns 0.
    // Fall back to the query without the first word so brand/product terms lead.
    const results = await this.fetchProducts(query);
    if (results.length > 0) return results;
    const words = query.trim().split(/\s+/);
    if (words.length > 1) return this.fetchProducts(words.slice(1).join(" "));
    return [];
  }

  private async fetchProducts(query: string): Promise<SearchResult[]> {
    const url = `https://viandvi.es/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}&per_page=5`;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return [];

      const data = (await response.json()) as WcProduct[];
      if (!Array.isArray(data)) return [];

      return data.flatMap((item) => {
        const productName = item.name;
        const rawPrice = item.prices?.price;
        const minorUnit = item.prices?.currency_minor_unit ?? 2;
        if (!productName || !rawPrice) return [];

        const price = Number.parseInt(rawPrice, 10) / Math.pow(10, minorUnit);
        if (!Number.isFinite(price) || price <= 0) return [];

        return [
          {
            storeSlug: this.storeSlug,
            storeName: this.storeName,
            productName,
            price,
            currency: "EUR",
            imageUrl: item.images?.[0]?.src ?? null,
            productUrl: item.permalink ?? "https://viandvi.es",
            // WooCommerce only returns OOS products when store admin
            // enables "Out of Stock Visibility". Read the field if
            // present; default to true (not returned = in stock).
            isAvailable: item.is_in_stock !== false,
            packageSize: extractPackageSize(productName),
          } satisfies SearchResult,
        ];
      });
    } catch {
      return [];
    }
  }
}
