import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// dosfarma.com uses Magento 2 with Algolia InstantSearch for product search.
// The Algolia credentials (applicationId + search-only API key) are embedded in
// window.algoliaConfig on every page load. The API key is a secured Algolia key
// (Base64-encoded with tagFilters restriction) — safe to use in server-side calls.
//
// Index name pattern: pro_dosfarma_es_products

const APP_ID = "5FYR88UN93";
const API_KEY =
  "MDcyZWIyZjVlOTk0YzRjMDg2ZTBiNmUzZTcyNWE3YjZhMGZkOWQwYmQ0NzE0NDcwNTc4MWI2ZTFmMzBmMGRmMHRhZ0ZpbHRlcnM9";
const INDEX = "pro_dosfarma_es_products";
const ALGOLIA_URL = `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX}/query`;

type AlgoliaHit = {
  name: string;
  price: { EUR: { default: number } };
  url: string;
  image_url?: string;
};

type AlgoliaResponse = {
  hits: AlgoliaHit[];
  nbHits: number;
};

export class DosFarmaSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "dosfarna"; // legacy slug kept to avoid DB migration
  readonly storeName = "DosFarma";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    let data: AlgoliaResponse;
    try {
      const response = await fetch(ALGOLIA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Algolia-Application-Id": APP_ID,
          "X-Algolia-API-Key": API_KEY,
        },
        body: JSON.stringify({ query, hitsPerPage: 5 }),
      });
      if (!response.ok) return [];
      data = (await response.json()) as AlgoliaResponse;
    } catch {
      return [];
    }

    return data.hits.map((hit) => ({
      storeSlug: this.storeSlug,
      storeName: this.storeName,
      productName: hit.name,
      price: hit.price.EUR.default,
      currency: "EUR",
      imageUrl: hit.image_url ?? null,
      productUrl: hit.url,
      isAvailable: true,
      ...parseProductQuantity(hit.name),
    }));
  }
}
