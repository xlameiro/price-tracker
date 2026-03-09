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
  /** EAN/GTIN barcode when the match was exact (EAN lookup) */
  ean?: string;
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
