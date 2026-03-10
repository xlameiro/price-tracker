import * as cheerio from "cheerio";
import { z } from "zod";
import { browserClient, parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const BASE = "https://www.compraonline.alcampo.es";
const PRODUCT_ID_RE = /\/products\/[^/]+\/(\d+)$/;
const INITIAL_STATE_RE = /window\.__INITIAL_STATE__=(\{.*?\})<\/script>/s;

const AlcampoEntitySchema = z
  .object({
    name: z.string().optional(),
    retailerProductId: z.string().optional(),
    available: z.boolean().optional(),
    image: z.object({ src: z.string().optional() }).loose().optional(),
    price: z
      .object({
        current: z
          .object({
            amount: z.string().optional(),
            currency: z.string().optional(),
          })
          .loose()
          .optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

type AlcampoEntity = z.infer<typeof AlcampoEntitySchema>;

const AlcampoStateSchema = z
  .object({
    data: z
      .object({
        search: z
          .object({
            catalogue: z
              .object({
                data: z
                  .object({
                    productGroups: z
                      .array(
                        z
                          .object({ products: z.array(z.string()).optional() })
                          .loose(),
                      )
                      .optional(),
                  })
                  .loose()
                  .optional(),
              })
              .loose()
              .optional(),
          })
          .loose()
          .optional(),
        products: z
          .object({
            productEntities: z
              .record(z.string(), AlcampoEntitySchema)
              .optional(),
          })
          .loose()
          .optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

function buildHrefMap($: cheerio.CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $('a[data-test="fop-product-link"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = PRODUCT_ID_RE.exec(href);
    if (match) map.set(match[1], href);
  });
  return map;
}

function parseInitialState(
  html: string,
): z.infer<typeof AlcampoStateSchema> | null {
  const match = INITIAL_STATE_RE.exec(html);
  if (!match) return null;
  try {
    const parsed = AlcampoStateSchema.safeParse(JSON.parse(match[1]));
    if (!parsed.success) {
      console.warn(
        "[alcampo-search] Unexpected __INITIAL_STATE__ shape:",
        parsed.error.issues[0]?.message,
      );
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function entityToResult(
  entity: AlcampoEntity,
  query: string,
  hrefMap: Map<string, string>,
  storeSlug: string,
  storeName: string,
): SearchResult | null {
  if (!entity.name || !entity.available) return null;
  const price = Number.parseFloat(entity.price?.current?.amount ?? "");
  if (!Number.isFinite(price) || price <= 0) return null;
  const href = hrefMap.get(entity.retailerProductId ?? "") ?? "";
  const productUrl = href
    ? `${BASE}${href}`
    : `${BASE}/search?q=${encodeURIComponent(query)}`;
  return {
    storeSlug,
    storeName,
    productName: entity.name,
    price,
    currency: "EUR",
    imageUrl: entity.image?.src ?? null,
    productUrl,
    isAvailable: true,
    ...parseProductQuantity(entity.name),
  };
}

export class AlcampoSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "alcampo";
  readonly storeName = "Alcampo";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `${BASE}/search?q=${encodeURIComponent(query)}`;
      const response = await browserClient.fetch(url, { timeout: 12_000 });
      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const hrefMap = buildHrefMap($);
      const state = parseInitialState(html);
      if (!state) return [];

      const entities = state.data?.products?.productEntities ?? {};
      const productGroups =
        state.data?.search?.catalogue?.data?.productGroups ?? [];
      const uuids = productGroups.flatMap((pg) => pg.products ?? []);
      const results: SearchResult[] = [];

      for (const uuid of uuids) {
        const entity = entities[uuid];
        if (!entity) continue;
        const result = entityToResult(
          entity,
          query,
          hrefMap,
          this.storeSlug,
          this.storeName,
        );
        if (result) results.push(result);
      }

      return results.slice(0, 5);
    } catch {
      return [];
    }
  }
}
