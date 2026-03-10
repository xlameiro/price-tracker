import { z } from "zod";
import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Nappy uses PrestaShop + IQITsearch module. Requesting the endpoint with
// Accept: application/json returns a compact JSON payload (~20KB) instead of
// the full search page HTML (~620KB), which was causing timeouts.
const NAPPY_SEARCH = "https://nappy.es/module/iqitsearch/searchiqit";

const NappyProductSchema = z
  .object({
    name: z.string().optional(),
    price_amount: z.number().optional(),
    url: z.string().optional(),
    cover: z
      .object({
        bySize: z
          .object({
            home_default: z
              .object({ url: z.string().optional() })
              .loose()
              .optional(),
          })
          .loose()
          .optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

const NappyResponseSchema = z
  .object({ products: z.array(NappyProductSchema).optional() })
  .loose();

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

      const parsed = NappyResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        console.warn(
          "[nappy-search] Unexpected API response shape:",
          parsed.error.issues[0]?.message,
        );
        return [];
      }
      const { data } = parsed;
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
            ...parseProductQuantity(productName),
          } satisfies SearchResult,
        ];
      });
    } catch {
      return [];
    }
  }
}
