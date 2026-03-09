import { extractPackageSize, fetchHtml } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const BASE_URL = "https://www.farmaciasdirect.es";

type ShopifyVariant = {
  price: number;
  name: string;
};

type ShopifyProduct = {
  handle: string;
  variants: ShopifyVariant[];
};

type ShopifyMeta = {
  products?: ShopifyProduct[];
};

export class FarmaciasDirectSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "farmaciasdirect";
  readonly storeName = "Farmacias Direct";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const html = await fetchHtml(
      `${BASE_URL}/search?q=${encodeURIComponent(query)}&type=product`,
    );
    if (!html) return [];

    const meta = extractShopifyMeta(html);
    if (!meta) return [];

    return (meta.products ?? [])
      .flatMap((product) => {
        const variant = product.variants[0];
        if (!variant?.name) return [];
        // Shopify prices are in cents
        const price = variant.price / 100;
        if (!Number.isFinite(price) || price <= 0) return [];
        return [
          {
            storeSlug: this.storeSlug,
            storeName: this.storeName,
            productName: variant.name,
            price,
            currency: "EUR",
            imageUrl: null,
            productUrl: `${BASE_URL}/products/${product.handle}`,
            isAvailable: true,
            packageSize: extractPackageSize(variant.name),
          } satisfies SearchResult,
        ];
      })
      .slice(0, 5);
  }
}

/** Extract `var meta = {...}` injected by Shopify Analytics without regex backtracking. */
function extractShopifyMeta(html: string): ShopifyMeta | null {
  const marker = 'var meta = {"products":';
  const markerIdx = html.indexOf(marker);
  if (markerIdx < 0) return null;

  // Walk brace depth to extract the full JSON object
  const jsonStart = markerIdx + "var meta = ".length;
  let depth = 0;
  let jsonEnd = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }
  if (jsonEnd === jsonStart) return null;

  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd)) as ShopifyMeta;
  } catch {
    return null;
  }
}
