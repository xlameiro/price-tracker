import { extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Carrefour uses Empathy.co as its search engine. The API is publicly
// accessible at api.empathy.co and bypasses Cloudflare WAF entirely.
const EMPATHY_API = "https://api.empathy.co/search/v1/query/carrefour/search";

type EmpathyItem = {
  display_name?: string;
  active_price?: number;
  urls?: { food?: string; nonFood?: string };
  image_path?: { food?: string; nonFood?: string };
  product_id?: string;
};

type EmpathyResponse = {
  catalog?: { content?: EmpathyItem[] };
};

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
            productUrl: `https://www.carrefour.es${urlPath}`,
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
