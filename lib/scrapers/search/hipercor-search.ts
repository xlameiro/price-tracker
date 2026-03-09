import {
  parseProductQuantity,
  fetchHtml,
  parseSpanishPrice,
} from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Hipercor is the hypermarket brand of El Corte Inglés (ECI) group. Both brands
// share the same Moonshine CMS backend and serve an identical online supermarket
// catalog at identical prices.
//
// hipercor.es is protected by Akamai Bot Manager — all non-browser clients
// (including impit Firefox) receive an interstitial challenge page. No product
// search JSON API exists; products are 100% server-side rendered.
//
// elcorteingles.es serves the same catalog without Akamai (Cloudflare CDN) and
// exposes window.__MOONSHINE_STATE__ in its SSR HTML. We fetch from ECI's domain
// and tag results with the "hipercor" storeSlug so price history remains separate.

// Product shape from window.__MOONSHINE_STATE__.viewData.plp.products
type MoonshineProduct = {
  description?: string;
  priceSpecification?: { price?: string; salePrice?: string };
  url?: string;
  image?: string;
};

/** Find the position of the matching closing `}` for the `{` at `start`. */
function findJsonEnd(html: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}" && --depth === 0) return i;
  }
  return -1;
}

function extractMoonshineProducts(html: string): MoonshineProduct[] {
  const markerIdx = html.indexOf("window.__MOONSHINE_STATE__");
  if (markerIdx === -1) return [];

  const jsonStart = html.indexOf("{", markerIdx);
  if (jsonStart === -1) return [];

  const jsonEnd = findJsonEnd(html, jsonStart);
  if (jsonEnd === -1) return [];

  try {
    const state = JSON.parse(html.slice(jsonStart, jsonEnd + 1)) as Record<
      string,
      unknown
    >;
    const plp = (state.viewData as Record<string, unknown> | undefined)?.plp as
      | Record<string, unknown>
      | undefined;
    return (plp?.products ?? []) as MoonshineProduct[];
  } catch {
    return [];
  }
}

export class HipercorSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "hipercor";
  readonly storeName = "Hipercor";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    // Fetch from ECI domain — same catalog, no Akamai, impit Chrome compatible
    const url = `https://www.elcorteingles.es/supermercado/buscar/?question=${encodeURIComponent(query)}&catalog=supermercado`;
    const html = await fetchHtml(url);
    if (!html) return [];

    const products = extractMoonshineProducts(html);
    const results: SearchResult[] = [];

    for (const product of products) {
      if (!product.description) continue;

      const rawPrice =
        product.priceSpecification?.salePrice ??
        product.priceSpecification?.price ??
        "";
      const price = parseSpanishPrice(rawPrice);
      if (!Number.isFinite(price) || price <= 0) continue;

      const href = product.url ?? "";
      const productUrl = href.startsWith("http")
        ? href
        : `https://www.elcorteingles.es${href}`;

      results.push({
        storeSlug: this.storeSlug,
        storeName: this.storeName,
        productName: product.description,
        price,
        currency: "EUR",
        imageUrl: product.image ?? null,
        productUrl,
        isAvailable: true,
        ...parseProductQuantity(product.description),
      });

      if (results.length >= 5) break;
    }

    return results;
  }
}
