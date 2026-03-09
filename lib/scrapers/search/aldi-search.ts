import { extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Search-only public key from Aldi's frontend bundle (safe to embed).
// App ID and API key are readable in the browser's React fiber tree / network tab.
const ALGOLIA_APP_ID = "L9KNU74IO7";
const ALGOLIA_API_KEY = "19b0e28f08344395447c7bdeea32da58";
// Both permanent catalog + rotating weekly offers are searched so any brand
// present on either catalogue will be found, regardless of regularity.
const ALGOLIA_INDEXES = ["prod_es_es_es_assortment", "prod_es_es_es_offers"];
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/*/queries`;

interface AlgoliaHit {
  productName?: string;
  brandName?: string;
  salesPrice?: number;
  productUrl?: string;
  productPicture?: string;
  availability?: string;
}

export class AldiSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "aldi";
  readonly storeName = "Aldi";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const body = JSON.stringify({
      requests: ALGOLIA_INDEXES.map((indexName) => ({
        indexName,
        params: new URLSearchParams({
          query,
          hitsPerPage: "5",
          attributesToRetrieve: [
            "productName",
            "brandName",
            "salesPrice",
            "productUrl",
            "productPicture",
            "availability",
          ].join(","),
        }).toString(),
      })),
    });

    let response: Response;
    try {
      response = await fetch(ALGOLIA_URL, {
        method: "POST",
        headers: {
          "x-algolia-application-id": ALGOLIA_APP_ID,
          "x-algolia-api-key": ALGOLIA_API_KEY,
          "content-type": "application/json",
        },
        body,
      });
    } catch {
      return [];
    }

    if (!response.ok) return [];

    const json = (await response.json()) as {
      results: { hits: AlgoliaHit[] }[];
    };
    const seen = new Set<string>();
    const results: SearchResult[] = [];

    for (const indexResult of json.results ?? []) {
      for (const hit of indexResult.hits ?? []) {
        const productName = [hit.brandName, hit.productName]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (!productName) continue;

        const price = hit.salesPrice;
        if (!price || !Number.isFinite(price) || price <= 0) continue;

        const productUrl = hit.productUrl ?? "https://www.aldi.es";
        if (seen.has(productUrl)) continue;
        seen.add(productUrl);

        results.push({
          storeSlug: this.storeSlug,
          storeName: this.storeName,
          productName,
          price,
          currency: "EUR",
          imageUrl: hit.productPicture ?? null,
          productUrl,
          isAvailable: true, // salesPrice present → in-store stock; "NONE" only means no online cart
          packageSize: extractPackageSize(productName),
        });
      }
    }

    return results.slice(0, 5);
  }
}
