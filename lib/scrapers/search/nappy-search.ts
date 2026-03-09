import { extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Nappy uses PrestaShop + IQITsearch module. Requesting the endpoint with
// Accept: application/json returns a compact JSON payload (~20KB) instead of
// the full search page HTML (~620KB), which was causing timeouts.
const NAPPY_SEARCH = "https://nappy.es/module/iqitsearch/searchiqit";

type NappyProduct = {
  name?: string;
  price_amount?: number;
  url?: string;
  cover?: {
    bySize?: { home_default?: { url?: string } };
  };
};

type NappyResponse = {
  products?: NappyProduct[];
};

export class NappySearchScraper implements StoreSearchScraper {
  readonly storeSlug = "nappy";
  readonly storeName = "Nappy";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const response = await fetch(
        `${NAPPY_SEARCH}?s=${encodeURIComponent(query)}`,
        {
          headers: { Accept: "application/json, text/javascript, */*" },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!response.ok) return [];

      const data = (await response.json()) as NappyResponse;
      return (data.products ?? []).slice(0, 5).flatMap((product) => {
        const productName = product.name;
        const price = product.price_amount;
        if (!productName || !price) return [];

        const productUrl = product.url ?? "";
        const imageUrl = product.cover?.bySize?.home_default?.url ?? null;

        return [
          {
            storeSlug: this.storeSlug,
            storeName: this.storeName,
            productName,
            price,
            currency: "EUR",
            imageUrl,
            productUrl,
            isAvailable: true,
            packageSize: extractPackageSize(productName),
          } satisfies SearchResult,
        ];
      });
    } catch {
      return [];
    }
  }
}
