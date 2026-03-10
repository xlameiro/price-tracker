import { z } from "zod";
import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const MagentoProductItemSchema = z
  .object({
    name: z.string(),
    url_key: z.string(),
    small_image: z.object({ url: z.string() }).loose().nullable().optional(),
    price_range: z.object({
      minimum_price: z.object({
        final_price: z.object({ value: z.number(), currency: z.string() }),
      }),
    }),
  })
  .loose();

const GraphQlResponseSchema = z
  .object({
    data: z
      .object({
        products: z
          .object({ items: z.array(MagentoProductItemSchema) })
          .loose()
          .optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

const GRAPHQL_QUERY = `
  query SearchProducts($search: String!) {
    products(search: $search, pageSize: 10) {
      items {
        name
        url_key
        small_image { url }
        price_range {
          minimum_price {
            final_price { value currency }
          }
        }
      }
    }
  }
`;

export class ArenalSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "arenal";
  readonly storeName = "Arenal.com";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const response = await fetch("https://www.arenal.com/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          query: GRAPHQL_QUERY,
          variables: { search: query },
        }),
      });

      if (!response.ok) return [];

      const parsed = GraphQlResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        console.warn(
          "[arenal-search] Unexpected API response shape:",
          parsed.error.issues[0]?.message,
        );
        return [];
      }
      const { data: json } = parsed;
      const items = json.data?.products?.items ?? [];

      return items
        .flatMap((item) => {
          const price = item.price_range.minimum_price.final_price.value;
          if (!Number.isFinite(price) || price <= 0) return [];

          return [
            {
              storeSlug: this.storeSlug,
              storeName: this.storeName,
              productName: item.name,
              price,
              currency: item.price_range.minimum_price.final_price.currency,
              imageUrl: item.small_image?.url ?? null,
              productUrl: `https://www.arenal.com/${item.url_key}`,
              isAvailable: true,
              ...parseProductQuantity(item.name),
            } satisfies SearchResult,
          ];
        })
        .slice(0, 5);
    } catch {
      return [];
    }
  }
}
