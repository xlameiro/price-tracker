import { EroskiSearchScraper } from "./eroski-search";
import { MercadonaSearchScraper } from "./mercadona-search";
import { resolveProductEans } from "./product-resolver";
import { isRelevant } from "./relevance";
import type { SearchResult, StoreSearchScraper } from "./types";

export type { SearchResult } from "./types";

// Only scrapers backed by reliable JSON APIs or HTML that actually returns results.
// Amazon, Carrefour, ECI, Alcampo, MediaMarkt, PcComponentes are SPA + bot-protected
// and return nothing from Vercel serverless — kept in their own files for future use.
const activeScrapers: StoreSearchScraper[] = [
  new MercadonaSearchScraper(),
  new EroskiSearchScraper(),
];

export const STORE_COUNT = activeScrapers.length;

/**
 * Two-phase search:
 *   1. Resolve the user query to EAN/GTIN barcodes via Open Food Facts.
 *   2. Run all active scrapers with both the query and the EANs.
 *      Scrapers that support EAN lookup (Mercadona) use it for exact matches;
 *      others fall back to text search with the relevance filter.
 *
 * Results are sorted by price ascending. Scrapers that fail never block others.
 */
export async function searchAllStores(query: string): Promise<SearchResult[]> {
  // Phase 1: resolve EANs (runs in background while we could start scraping,
  // but stores that support EAN lookup produce better results, so we wait)
  const { eans } = await resolveProductEans(query);
  const ctx = { query, eans };

  // Phase 2: run all active scrapers in parallel with the resolved context
  const settled = await Promise.allSettled(
    activeScrapers.map((scraper) => scraper.search(ctx)),
  );

  const all = settled
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    // EAN-matched results are always relevant; apply relevance filter only to
    // text-search results (those without an `ean` field set)
    .filter((r) => r.ean !== undefined || isRelevant(r.productName, query));

  return all.sort((a, b) => a.price - b.price);
}
