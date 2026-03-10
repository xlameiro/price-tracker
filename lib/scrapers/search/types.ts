import { z } from "zod";

export interface SearchResult {
  storeSlug: string;
  storeName: string;
  productName: string;
  /** Standard single-purchase price */
  price: number;
  /** Subscribe & Save / recurring purchase price — lower than price when available */
  subscribePrice?: number;
  currency: string;
  imageUrl: string | null;
  productUrl: string;
  isAvailable: boolean;
  /** Number of units in the pack (e.g. 44 diapers) — extracted from product name or known */
  packageSize?: number;
  /** Net weight (grams) or volume (millilitres) of a single unit — used for €/100g or €/100ml comparison */
  netWeight?: number;
  /** Unit for netWeight: 'g' = grams, 'ml' = millilitres */
  netWeightUnit?: "g" | "ml";
  /** EAN/GTIN barcode when the match was exact (EAN lookup) */
  ean?: string;
}

/**
 * Runtime Zod schema matching `SearchResult`.
 * Used to validate and filter scraper output at the aggregator boundary —
 * rejects entries with NaN prices, empty names, or structurally invalid fields
 * before they reach the UI.
 */
export const SearchResultSchema = z.object({
  storeSlug: z.string().min(1),
  storeName: z.string().min(1),
  productName: z.string().min(1),
  price: z.number().gt(0),
  subscribePrice: z.number().gt(0).optional(),
  currency: z.string().min(1),
  imageUrl: z.string().nullable(),
  productUrl: z.string().min(1),
  isAvailable: z.boolean(),
  packageSize: z.number().int().gt(0).optional(),
  netWeight: z.number().gt(0).optional(),
  netWeightUnit: z.enum(["g", "ml"]).optional(),
  ean: z.string().optional(),
});

/**
 * Filter an array of raw scraper results to only valid `SearchResult` entries.
 * Invalid entries (NaN price, empty name, etc.) are silently dropped — they are
 * almost always scraper parsing artefacts, not user-visible errors.
 */
export function validateSearchResults(raw: SearchResult[]): SearchResult[] {
  return raw.filter((item) => SearchResultSchema.safeParse(item).success);
}

/**
 * Context passed to every store scraper.
 * `eans` contains EAN/GTIN barcodes resolved from Open Food Facts —
 * scrapers should prefer EAN-based lookup over text search when possible.
 */
export interface SearchContext {
  /** Original user query */
  query: string;
  /** EAN/GTIN codes from product database, most popular first (may be empty) */
  eans: string[];
}

export interface StoreSearchScraper {
  storeSlug: string;
  storeName: string;
  search(ctx: SearchContext): Promise<SearchResult[]>;
}
