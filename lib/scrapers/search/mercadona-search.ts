import { browserClient, parseProductQuantity } from "./scraper-utils";
import type { ParsedQuantity } from "./scraper-utils";
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
  // Structured quantity fields (present on every product in the Mercadona API)
  size_format?: string | null; // "ud" | "l" | "ml" | "cl" | "g" | "kg"
  unit_size?: number | null; // total quantity in size_format units
  is_pack?: boolean; // true when product is a multi-container bundle
  pack_size?: number | null; // size of each individual container (when is_pack=true)
  total_units?: number | null; // number of containers in the bundle (when is_pack=true)
  unit_name?: string | null; // "botellas", "paquetes", etc.
};

// Convert a Mercadona size_format + numeric value to { netWeight, netWeightUnit }.
// Returns null for "ud" (units) or unknown formats.
function fmtToNetWeight(
  fmt: string,
  value: number,
): { netWeight: number; netWeightUnit: "g" | "ml" } | null {
  switch (fmt) {
    case "l":
      return { netWeight: Math.round(value * 1000), netWeightUnit: "ml" };
    case "ml":
      return { netWeight: Math.round(value), netWeightUnit: "ml" };
    case "cl":
      return { netWeight: Math.round(value * 10), netWeightUnit: "ml" };
    case "kg":
      return { netWeight: Math.round(value * 1000), netWeightUnit: "g" };
    case "g":
    case "gr":
      return { netWeight: Math.round(value), netWeightUnit: "g" };
    default:
      return null;
  }
}

// Extract ParsedQuantity from Mercadona's structured price_instructions object.
// More reliable than name-based parsing because it uses API-provided numeric fields
// rather than regex-matching product titles that may embed baby weight ranges, etc.
export function piToQuantity(pi: MercadonaPriceInstructions): ParsedQuantity {
  const fmt = String(pi.size_format ?? "").toLowerCase();
  const unitSize = typeof pi.unit_size === "number" ? pi.unit_size : null;
  const packSize = typeof pi.pack_size === "number" ? pi.pack_size : null;
  const totalUnits = typeof pi.total_units === "number" ? pi.total_units : null;
  const isPack = Boolean(pi.is_pack);

  if (!unitSize || unitSize <= 0) return {};

  // "ud" = countable items (diapers, wipes, capsules, etc.)
  if (fmt === "ud") {
    // unit_size is always total item count (pack_size × total_units when is_pack=true)
    return { packageSize: Math.round(unitSize) };
  }

  // For packs: each container's size comes from pack_size; for singles: use unit_size
  const sizeValue = isPack && packSize && packSize > 0 ? packSize : unitSize;
  const weight = fmtToNetWeight(fmt, sizeValue);
  if (!weight) return {};

  if (isPack && totalUnits && totalUnits >= 2) {
    return { packageSize: totalUnits, ...weight };
  }

  return weight;
}

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

// Prefer structured API fields over name-based regex parsing. Name parsing is
// unreliable for Mercadona because product titles embed baby weight ranges
// (e.g. "Pañales talla 5 de 11-16 kg") which trip up weight extractors.
function resolveQuantity(
  pi: MercadonaPriceInstructions,
  name: string,
): ParsedQuantity {
  const fromApi = piToQuantity(pi);
  const hasApiQty =
    fromApi.packageSize !== undefined || fromApi.netWeight !== undefined;
  return hasApiQty ? fromApi : parseProductQuantity(name);
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
  const quantity = resolveQuantity(product.price_instructions ?? {}, name);

  return {
    storeSlug: "mercadona",
    storeName: "Mercadona",
    productName: name,
    price,
    currency: "EUR",
    imageUrl,
    productUrl: `https://tienda.mercadona.es/product/${encodeURIComponent(slug)}`,
    isAvailable: true,
    ...quantity,
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
