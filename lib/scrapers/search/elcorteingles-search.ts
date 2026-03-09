import {
  extractPackageSize,
  fetchHtml,
  parseSpanishPrice,
} from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Product shape from window.__MOONSHINE_STATE__.viewData.plp.products
type EciProduct = {
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

/**
 * Extract the JSON assigned to `window.__MOONSHINE_STATE__` in raw HTML.
 * ECI server-side renders all product data into this global before shipping HTML.
 */
function extractMoonshineState(html: string): Record<string, unknown> | null {
  const markerIdx = html.indexOf("window.__MOONSHINE_STATE__");
  if (markerIdx === -1) return null;

  const jsonStart = html.indexOf("{", markerIdx);
  if (jsonStart === -1) return null;

  const jsonEnd = findJsonEnd(html, jsonStart);
  if (jsonEnd === -1) return null;

  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function toSearchResult(
  product: EciProduct,
  storeSlug: string,
  storeName: string,
): SearchResult | null {
  if (!product.description) return null;

  const rawPrice =
    product.priceSpecification?.salePrice ??
    product.priceSpecification?.price ??
    "";
  const price = parseSpanishPrice(rawPrice);
  if (!Number.isFinite(price) || price <= 0) return null;

  const href = product.url ?? "";
  const productUrl = href.startsWith("http")
    ? href
    : `https://www.elcorteingles.es${href}`;

  return {
    storeSlug,
    storeName,
    productName: product.description,
    price,
    currency: "EUR",
    imageUrl: product.image ?? null,
    productUrl,
    isAvailable: true,
    packageSize: extractPackageSize(product.description),
  };
}

export class ElCorteInglesSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "elcorteingles";
  readonly storeName = "El Corte Inglés";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const url = `https://www.elcorteingles.es/supermercado/buscar/?question=${encodeURIComponent(query)}&catalog=supermercado`;
    const html = await fetchHtml(url);
    if (!html) return [];

    const state = extractMoonshineState(html);
    const plp = (state?.viewData as Record<string, unknown> | undefined)
      ?.plp as Record<string, unknown> | undefined;
    const products = (plp?.products ?? []) as EciProduct[];

    return products
      .map((p) => toSearchResult(p, this.storeSlug, this.storeName))
      .filter((r): r is SearchResult => r !== null)
      .slice(0, 5);
  }
}
