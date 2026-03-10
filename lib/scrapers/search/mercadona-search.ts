import { z } from "zod";
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
    const parsed = MercadonaProductSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.warn(
        "[mercadona-search] Unexpected EAN lookup response shape:",
        parsed.error.issues[0]?.message,
      );
      return null;
    }
    return toSearchResult(parsed.data as MercadonaProduct, ean);
  } catch {
    return null;
  }
}

// ── Text-search fallback ──────────────────────────────────────────────────────
//
// Mercadona's /api/search/ endpoint was removed, so we fall back to browsing
// categories. We try two strategies in order:
//
//   1. Dynamic — fetch the full category tree and pick the 1–2 categories whose
//      name best matches the query keywords. Works for any product type.
//
//   2. Static  — if the category tree fetch fails or returns no match, browse
//      category 217 ("Toallitas y pañales") which is the known fallback for the
//      diapers/wipes use-case this app was originally built for.

// Minimal Zod schemas for the two API response casts below.
// Using .loose() throughout to tolerate extra fields added in future API versions.
const MercadonaProductSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    display_name: z.string().optional(),
    price_instructions: z.record(z.string(), z.unknown()).optional(),
    photos: z.array(z.record(z.string(), z.unknown())).optional(),
    slug: z.string().optional(),
  })
  .loose();

const MercadonaCategoryResponseSchema = z
  .object({
    categories: z
      .array(
        z
          .object({
            id: z.string().optional(),
            name: z.string().optional(),
            products: z.array(MercadonaProductSchema).optional(),
          })
          .loose(),
      )
      .optional(),
  })
  .loose();

type MercadonaTopCategory = {
  id?: string | number;
  name?: string;
  categories?: Array<{ id?: string | number; name?: string }>;
};

// Process-level cache — effective for warm serverless invocations.
let _topCategoryCache: MercadonaTopCategory[] | null = null;

async function fetchTopCategories(): Promise<MercadonaTopCategory[]> {
  if (_topCategoryCache) return _topCategoryCache;
  try {
    const url = `${BASE}/categories/?lang=${LANG}&wh=${WH}`;
    const response = await browserClient.fetch(url, {
      timeout: 5_000,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const raw = (await response.json()) as unknown;
    const rec = raw as Record<string, unknown>;
    let arr: MercadonaTopCategory[];
    if (Array.isArray(raw)) {
      arr = raw as MercadonaTopCategory[];
    } else if (Array.isArray(rec.results)) {
      arr = rec.results as MercadonaTopCategory[];
    } else if (Array.isArray(rec.categories)) {
      arr = rec.categories as MercadonaTopCategory[];
    } else {
      arr = [];
    }
    _topCategoryCache = arr;
    return arr;
  } catch {
    return [];
  }
}

function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/**
 * Returns the Mercadona category IDs most relevant to the query. Matches query
 * keywords against top-level category names. Always includes category 217
 * (Toallitas y pañales) as a fallback so existing diaper/wipe searches keep
 * working even if dynamic discovery finds no match.
 */
async function resolveCategoryIds(query: string): Promise<string[]> {
  const topCategories = await fetchTopCategories();
  const keywords = normText(query)
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const matched: string[] = [];
  for (const cat of topCategories) {
    const catName = normText(cat.name ?? "");
    if (keywords.some((kw) => catName.includes(kw))) {
      const id = String(cat.id ?? "").trim();
      if (id) matched.push(id);
      // Also include direct sub-categories if available in the tree response
      for (const sub of cat.categories ?? []) {
        const subId = String(sub.id ?? "").trim();
        if (subId) matched.push(subId);
      }
    }
  }

  const DIAPERS_CATEGORY_ID = "217";
  if (!matched.includes(DIAPERS_CATEGORY_ID)) matched.push(DIAPERS_CATEGORY_ID);
  // Cap at 3 categories to stay within the per-scraper timeout budget.
  return [...new Set(matched)].slice(0, 3);
}

async function fetchCategoryProducts(
  categoryId: string,
): Promise<MercadonaProduct[]> {
  try {
    const url = `${BASE}/categories/${categoryId}/?lang=${LANG}&wh=${WH}`;
    const response = await browserClient.fetch(url, {
      timeout: 8_000,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const parsed = MercadonaCategoryResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      console.warn(
        "[mercadona-search] Unexpected category response shape:",
        parsed.error.issues[0]?.message,
      );
      return [];
    }
    return (parsed.data.categories ?? []).flatMap(
      (cat) => (cat.products ?? []) as MercadonaProduct[],
    );
  } catch {
    return [];
  }
}

async function searchByText(query: string): Promise<SearchResult[]> {
  const categoryIds = await resolveCategoryIds(query);
  const productArrays = await Promise.all(
    categoryIds.map(fetchCategoryProducts),
  );
  const allProducts = productArrays.flat();

  // Keyword filter (≥ 2 chars) — prefer recall; the relevance filter in
  // searchAllStores will do the final precision cut.
  const keywords = normText(query)
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const seen = new Set<string>();
  const matched: MercadonaProduct[] = [];
  for (const p of allProducts) {
    const id = String(p.id ?? "");
    if (seen.has(id)) continue;
    seen.add(id);
    const name = normText(p.display_name ?? "");
    if (keywords.some((kw) => name.includes(kw))) matched.push(p);
  }

  return matched.slice(0, 10).flatMap((p) => {
    const result = toSearchResult(p);
    return result ? [result] : [];
  });
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
