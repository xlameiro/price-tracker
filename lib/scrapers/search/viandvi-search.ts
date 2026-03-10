import { z } from "zod";
import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// viandvi.com is gone. The live store is viandvi.es (WooCommerce).
// The search results page doesn't show prices, so we use the WooCommerce Store REST API.
const WcProductSchema = z
  .object({
    name: z.string().optional(),
    prices: z
      .object({
        price: z.string().optional(),
        currency_minor_unit: z.number().optional(),
      })
      .loose()
      .optional(),
    permalink: z.string().optional(),
    images: z
      .array(z.object({ src: z.string().optional() }).loose())
      .optional(),
    // WooCommerce Store API v1 availability fields
    is_in_stock: z.boolean().optional(),
    on_backorder: z.boolean().optional(),
  })
  .loose();

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

      const parsed = z.array(WcProductSchema).safeParse(await response.json());
      if (!parsed.success) {
        console.warn(
          "[viandvi-search] Unexpected API response shape:",
          parsed.error.issues[0]?.message,
        );
        return [];
      }
      const { data } = parsed;

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
            ...parseProductQuantity(productName),
          } satisfies SearchResult,
        ];
      });
    } catch {
      return [];
    }
  }
}
