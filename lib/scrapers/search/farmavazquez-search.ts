import { z } from "zod";
import { parseProductQuantity } from "./scraper-utils";
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

const DoofinderItemSchema = z
  .object({
    title: z.string(),
    best_price: z.number(),
    price: z.number(),
    link: z.string(),
    image_link: z.string().optional(),
    availability: z.string().optional(),
  })
  .loose();

const DoofinderResponseSchema = z
  .object({
    results: z.array(DoofinderItemSchema).optional(),
    total: z.number().optional(),
  })
  .loose();

export class FarmaVazquezSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "farmavazquez";
  readonly storeName = "FarmaVázquez";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const url =
      `${DOOFINDER_API}?hashid=${HASHID}` +
      `&query=${encodeURIComponent(query)}` +
      `&page=1&rpp=5&lang=es` +
      `&filter%5Bavailability%5D=in+stock`;

    try {
      const response = await fetch(url, {
        headers: {
          Origin: "https://www.farmavazquez.com",
          Referer: "https://www.farmavazquez.com/",
        },
      });
      if (!response.ok) return [];
      const parsed = DoofinderResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        console.warn(
          "[farmavazquez-search] Unexpected API response shape:",
          parsed.error.issues[0]?.message,
        );
        return [];
      }
      const { data } = parsed;
      return (data.results ?? []).map((item) => ({
        storeSlug: this.storeSlug,
        storeName: this.storeName,
        productName: item.title,
        price: Math.round(item.best_price * 100) / 100,
        currency: "EUR",
        imageUrl: item.image_link ?? null,
        productUrl: item.link,
        isAvailable: true,
        ...parseProductQuantity(item.title),
      }));
    } catch {
      return [];
    }
  }
}
