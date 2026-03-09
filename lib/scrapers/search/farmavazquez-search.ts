import { extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// FarmaVázquez uses Doofinder as its search engine. The native PrestaShop search
// page ignores URL query params — results are rendered entirely via Doofinder's JS
// overlay. We call the Doofinder search API directly instead.
//
// The Origin header is required: Doofinder validates the request origin against
// the registered domains for the store's account (hashid). Without it the API
// returns 403 "request not authenticated".

const DOOFINDER_API = "https://eu1-search.doofinder.com/5/search";
const HASHID = "b8385fd3e2f32aadf43c359fb6791646";

type DoofinderItem = {
  title: string;
  best_price: number;
  price: number;
  link: string;
  image_link?: string;
  availability?: string;
};

type DoofinderResponse = {
  results?: DoofinderItem[];
  total?: number;
};

export class FarmaVazquezSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "farmavazquez";
  readonly storeName = "FarmaVázquez";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const url =
      `${DOOFINDER_API}?hashid=${HASHID}` +
      `&query=${encodeURIComponent(query)}` +
      `&page=1&rpp=5&lang=es` +
      `&filter%5Bavailability%5D=in+stock`;

    let data: DoofinderResponse;
    try {
      const response = await fetch(url, {
        headers: {
          Origin: "https://www.farmavazquez.com",
          Referer: "https://www.farmavazquez.com/",
        },
      });
      if (!response.ok) return [];
      data = (await response.json()) as DoofinderResponse;
    } catch {
      return [];
    }

    return (data.results ?? []).map((item) => ({
      storeSlug: this.storeSlug,
      storeName: this.storeName,
      productName: item.title,
      price: Math.round(item.best_price * 100) / 100,
      currency: "EUR",
      imageUrl: item.image_link ?? null,
      productUrl: item.link,
      isAvailable: true,
      packageSize: extractPackageSize(item.title),
    }));
  }
}
