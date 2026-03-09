import { extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// atida.com (previously MiFarma) uses Magento 2 with Algolia InstantSearch.
// The Algolia credentials are embedded in window.algoliaConfig on every page.
// The /es-es/search route returns 404 — the correct Magento search URL is
// /es-es/catalogsearch/result/?q=QUERY. We bypass the HTML layer and call the
// Algolia API directly using the search-only key from the page config.

const APP_ID = "M8GRS7KXGP";
const API_KEY =
  "ZDFkYzBhZTRhMTZkYTUzZWU3YTg4MGIxNGM3MmRiYTNjZGY0YWYwYzdhYTZlNjRiZjIyYTllMzA3MThlYjdmZnRhZ0ZpbHRlcnM9";
const INDEX = "atida_es_es_products";
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

export class AtidaSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "atida";
  readonly storeName = "Atida / MiFarma";

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
      packageSize: extractPackageSize(hit.name),
    }));
  }
}
