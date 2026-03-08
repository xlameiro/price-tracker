import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Mercadona exposes two official-looking JSON APIs used by tienda.mercadona.es:
//   1. EAN lookup  — exact product by barcode (preferred)
//   2. Text search — fallback when no EANs are available

const BASE = "https://tienda.mercadona.es/api";
// bcn1 (Barcelona) covers most of Spain for server-side requests
const WH = "bcn1";
const LANG = "es";

type MercadonaPhoto = { regular?: string; zoom?: string };
type MercadonaPriceInstructions = {
  unit_price?: number | string;
  bulk_price?: number | string;
};

type MercadonaProduct = {
  id?: number | string;
  display_name?: string;
  price_instructions?: MercadonaPriceInstructions;
  photos?: MercadonaPhoto[];
  slug?: string;
};

type MercadonaCategory = {
  id?: string;
  name?: string;
  products?: MercadonaProduct[];
};

type MercadonaResultItem = {
  type?: string;
  item?: MercadonaProduct;
};

function extractProducts(data: unknown): MercadonaProduct[] {
  if (!data || typeof data !== "object") return [];

  // Shape: top-level array of products
  if (Array.isArray(data)) {
    return data as MercadonaProduct[];
  }

  const { results } = data as Record<string, unknown>;
  if (!results) return [];

  // Shape: results is an array of {type, item}
  if (Array.isArray(results)) {
    return (results as MercadonaResultItem[])
      .filter((r) => r.type === "product" && r.item != null)
      .map((r) => r.item as MercadonaProduct);
  }

  if (typeof results !== "object") return [];
  const resultsObj = results as Record<string, unknown>;

  // Shape: results.products[]
  if (Array.isArray(resultsObj["products"])) {
    return resultsObj["products"] as MercadonaProduct[];
  }

  // Shape: results.categories[].products[]
  if (Array.isArray(resultsObj["categories"])) {
    return (resultsObj["categories"] as MercadonaCategory[]).flatMap(
      (cat) => cat.products ?? [],
    );
  }

  return [];
}

function toSearchResult(
  product: MercadonaProduct,
  ean?: string,
): SearchResult | null {
  const name = product.display_name;
  const rawPrice = product.price_instructions?.unit_price;
  const price =
    typeof rawPrice === "string"
      ? Number.parseFloat(rawPrice)
      : (rawPrice ?? 0);

  if (!name || !Number.isFinite(price) || price <= 0) return null;

  const slug = product.slug ?? String(product.id ?? "");
  const imageUrl = product.photos?.[0]?.regular ?? null;

  return {
    storeSlug: "mercadona",
    storeName: "Mercadona",
    productName: name,
    price,
    currency: "EUR",
    imageUrl,
    productUrl: `https://tienda.mercadona.es/product/${encodeURIComponent(slug)}`,
    isAvailable: true,
    ...(ean && { ean }),
  };
}

// Try exact EAN/barcode lookup — returns null if not found in Mercadona's catalog
async function lookupByEan(ean: string): Promise<SearchResult | null> {
  try {
    const url = `${BASE}/products/${encodeURIComponent(ean)}/?lang=${LANG}&wh=${WH}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return null;
    return toSearchResult((await response.json()) as MercadonaProduct, ean);
  } catch {
    return null;
  }
}

// Text-search fallback used when no EANs resolve to a result
async function searchByText(query: string): Promise<SearchResult[]> {
  try {
    const url = `${BASE}/search/?q=${encodeURIComponent(query)}&lang=${LANG}&wh=${WH}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json, */*",
        "Accept-Language": "es-ES,es;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    return extractProducts(await response.json())
      .slice(0, 5)
      .flatMap((p) => {
        const result = toSearchResult(p);
        return result ? [result] : [];
      });
  } catch {
    return [];
  }
}

export class MercadonaSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "mercadona";
  readonly storeName = "Mercadona";

  async search({ query, eans }: SearchContext): Promise<SearchResult[]> {
    // Phase 1: try each EAN in parallel — exact match preferred
    if (eans.length > 0) {
      const eanResults = (await Promise.all(eans.map(lookupByEan))).flatMap(
        (r) => (r ? [r] : []),
      );
      if (eanResults.length > 0) return eanResults;
    }
    // Phase 2: fall back to text search
    return searchByText(query);
  }
}
