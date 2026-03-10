import { z } from "zod";
import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// MasPanales uses PrestaShop + IQITsearch module (same as Nappy).
// Accept: application/json returns a compact JSON payload instead of the full
// search page HTML (~540KB), which is faster and more reliable.
const MASPANALES_SEARCH = "https://maspanales.com/module/iqitsearch/searchiqit";

const MasPanalesProductSchema = z
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

const MasPanalesResponseSchema = z
  .object({ products: z.array(MasPanalesProductSchema).optional() })
  .loose();

export class MasPanalesSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "maspanales";
  readonly storeName = "Más Pañales";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    // maspanales.es is a dead/legacy domain, real store is maspanales.com.
    // Search uses the IQITsearch PrestaShop module with the 's' parameter.
    try {
      const response = await fetch(
        `${MASPANALES_SEARCH}?s=${encodeURIComponent(query)}`,
        {
          headers: { Accept: "application/json, text/javascript, */*" },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!response.ok) return [];

      const parsed = MasPanalesResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        console.warn(
          "[maspanales-search] Unexpected API response shape:",
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
