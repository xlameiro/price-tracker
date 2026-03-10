import { parseProductQuantity } from "./scraper-utils";
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
  // Structured quantity fields — more reliable than parsing the product name
  salesUnit?: string; // e.g. "250 g unidad", "pack de 12 x 0,33 l", "unidad"
}

// Prefer structured salesUnit over product name for quantity. Aldi product names
// rarely embed size info, but salesUnit always contains it in a clean format.
function resolveAldiQuantity(
  salesUnit: string | undefined,
  productName: string,
) {
  if (salesUnit) {
    const fromUnit = parseProductQuantity(salesUnit);
    if (
      fromUnit.packageSize !== undefined ||
      fromUnit.netWeight !== undefined
    ) {
      return fromUnit;
    }
  }
  return parseProductQuantity(productName);
}

function hitToResult(
  hit: AlgoliaHit,
  storeSlug: string,
  storeName: string,
): (SearchResult & { productUrl: string }) | null {
  const productName = [hit.brandName, hit.productName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!productName) return null;

  const price = hit.salesPrice;
  if (!price || !Number.isFinite(price) || price <= 0) return null;

  const productUrl = hit.productUrl ?? "https://www.aldi.es";
  return {
    storeSlug,
    storeName,
    productName,
    price,
    currency: "EUR",
    imageUrl: hit.productPicture ?? null,
    productUrl,
    isAvailable: true, // salesPrice present → in-store stock; "NONE" only means no online cart
    ...resolveAldiQuantity(hit.salesUnit, productName),
  };
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
            "salesUnit",
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
        const result = hitToResult(hit, this.storeSlug, this.storeName);
        if (!result || seen.has(result.productUrl)) continue;
        seen.add(result.productUrl);
        results.push(result);
      }
    }

    return results.slice(0, 5);
  }
}
