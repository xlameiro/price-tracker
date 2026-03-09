import * as cheerio from "cheerio";
import { browserClient, parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const BASE = "https://www.compraonline.alcampo.es";
const PRODUCT_ID_RE = /\/products\/[^/]+\/(\d+)$/;
const INITIAL_STATE_RE = /window\.__INITIAL_STATE__=(\{.*?\})<\/script>/s;

type AlcampoEntity = {
  name?: string;
  retailerProductId?: string;
  available?: boolean;
  image?: { src?: string };
  price?: { current?: { amount?: string; currency?: string } };
};

type AlcampoState = {
  data?: {
    search?: {
      catalogue?: { data?: { productGroups?: Array<{ products?: string[] }> } };
    };
    products?: { productEntities?: Record<string, AlcampoEntity> };
  };
};

function buildHrefMap($: cheerio.CheerioAPI): Map<string, string> {
  const map = new Map<string, string>();
  $('a[data-test="fop-product-link"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = PRODUCT_ID_RE.exec(href);
    if (match) map.set(match[1], href);
  });
  return map;
}

function parseInitialState(html: string): AlcampoState | null {
  const match = INITIAL_STATE_RE.exec(html);
  if (!match) return null;
  return JSON.parse(match[1]) as AlcampoState;
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
        const result = entityToResult(
          entities[uuid] ?? {},
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
