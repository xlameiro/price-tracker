import { browserClient, parseProductQuantity } from "./scraper-utils";
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
    ...parseProductQuantity(name),
    ...(ean && { ean }),
  };
}

// Try exact EAN/barcode lookup — returns null if not found in Mercadona's catalog
async function lookupByEan(ean: string): Promise<SearchResult | null> {
  try {
    const url = `${BASE}/products/${encodeURIComponent(ean)}/?lang=${LANG}&wh=${WH}`;
    const response = await browserClient.fetch(url, {
      timeout: 6_000,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return toSearchResult((await response.json()) as MercadonaProduct, ean);
  } catch {
    return null;
  }
}

// The /api/search/ endpoint was removed from Mercadona's API.
// Fallback: browse category 217 ("Toallitas y pañales") and filter by query keywords.
// This covers the only product category tracked by this app.
const DIAPERS_CATEGORY_ID = "217";

type MercadonaCategoryResponse = { categories?: MercadonaCategory[] };

async function searchByText(query: string): Promise<SearchResult[]> {
  try {
    const url = `${BASE}/categories/${DIAPERS_CATEGORY_ID}/?lang=${LANG}&wh=${WH}`;
    const response = await browserClient.fetch(url, {
      timeout: 10_000,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as MercadonaCategoryResponse;
    const allProducts = (data.categories ?? []).flatMap(
      (cat) => cat.products ?? [],
    );

    // Keyword filter (≥ 2 chars) so the relevance filter in searchAllStores can
    // further evaluate each result — we prefer recall over precision here.
    const keywords = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    const matched = allProducts.filter((p) => {
      const name = String(p.display_name ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return keywords.some((kw) => name.includes(kw));
    });

    return matched.slice(0, 10).flatMap((p) => {
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
    if (eans?.length > 0) {
      const eanResults = (await Promise.all(eans.map(lookupByEan))).flatMap(
        (r) => (r ? [r] : []),
      );
      if (eanResults.length > 0) return eanResults;
    }
    // Phase 2: fall back to text search
    return searchByText(query);
  }
}
