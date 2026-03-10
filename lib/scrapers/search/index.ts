import { AhorramasSearchScraper } from "./ahorramas-search";
import { AlcampoSearchScraper } from "./alcampo-search";
import { AldiSearchScraper } from "./aldi-search";
import { AmazonSearchScraper } from "./amazon-search";
import { ArenalSearchScraper } from "./arenal-search";
import { AtidaSearchScraper } from "./atida-search";
import { BmSearchScraper } from "./bm-search";
import { CarrefourSearchScraper } from "./carrefour-search";
import { DiaSearchScraper } from "./dia-search";
import { DosFarmaSearchScraper } from "./dosfarma-search";
import { ElCorteInglesSearchScraper } from "./elcorteingles-search";
import { EroskiSearchScraper } from "./eroski-search";
import { FarmaciasDirectSearchScraper } from "./farmaciasdirect-search";
import { FarmaVazquezSearchScraper } from "./farmavazquez-search";
import { FroizSearchScraper } from "./froiz-search";
import { GadisSearchScraper } from "./gadis-search";
import { HipercorSearchScraper } from "./hipercor-search";
// To re-enable Lidl: add `import { LidlSearchScraper } from "./lidl-search"` and uncomment below.
import { MasPanalesSearchScraper } from "./maspanales-search";
import { MercadonaSearchScraper } from "./mercadona-search";
import { NappySearchScraper } from "./nappy-search";
import { PrimorSearchScraper } from "./primor-search";
import { resolveProductEans } from "./product-resolver";
// To re-enable PromoFarma: add `import { PromoFarmaSearchScraper } from "./promofarma-search"` and uncomment below.
import { filterVariantConflicts, isRelevant } from "./relevance";
import { SupermercadoFamiliaSearchScraper } from "./supermercado-familia-search";
import type { SearchResult, StoreSearchScraper } from "./types";
import { validateSearchResults } from "./types";
import { ViandviSearchScraper } from "./viandvi-search";

export type { SearchResult } from "./types";

// Only scrapers backed by reliable JSON APIs or HTML that actually returns results.
// Amazon, Carrefour, ECI, Alcampo, MediaMarkt, PcComponentes are SPA + bot-protected
// and return nothing from Vercel serverless — kept in their own files for future use.
const activeScrapers: StoreSearchScraper[] = [
  new MercadonaSearchScraper(),
  new EroskiSearchScraper(),
  new CarrefourSearchScraper(),
  new AlcampoSearchScraper(),
  new ElCorteInglesSearchScraper(),
  new HipercorSearchScraper(),
  new AhorramasSearchScraper(),
  new GadisSearchScraper(),
  new FroizSearchScraper(),
  new BmSearchScraper(),
  new SupermercadoFamiliaSearchScraper(),
  new AldiSearchScraper(),
  new ArenalSearchScraper(),
  new PrimorSearchScraper(),
  new DosFarmaSearchScraper(),
  new AtidaSearchScraper(),
  new FarmaciasDirectSearchScraper(),
  new FarmaVazquezSearchScraper(),
  new ViandviSearchScraper(),
  new AmazonSearchScraper(),
  new NappySearchScraper(),
  new MasPanalesSearchScraper(),
  new DiaSearchScraper(),
  // PromoFarma: React SPA — CSS selectors return 0 results from serverless (no real API found).
  // new PromoFarmaSearchScraper(),
  // Lidl: Nuxt.js SPA — window.__NUXT__ is empty; product grid requires JS execution.
  // Re-enable once a Playwright-capable scraper is implemented.
  // new LidlSearchScraper(),
];

export const STORE_COUNT = activeScrapers.length;

/**
 * Deduplicate results keeping the single best (cheapest per-unit) entry per store.
 * When packageSize is unknown, falls back to the raw price for comparison.
 */
function deduplicateByStore(results: SearchResult[]): SearchResult[] {
  const best = new Map<string, SearchResult>();
  for (const result of results) {
    const existing = best.get(result.storeSlug);
    if (!existing) {
      best.set(result.storeSlug, result);
      continue;
    }
    const existingUnit =
      (existing.subscribePrice ?? existing.price) / (existing.packageSize ?? 1);
    const newUnit =
      (result.subscribePrice ?? result.price) / (result.packageSize ?? 1);
    if (newUnit < existingUnit) best.set(result.storeSlug, result);
  }
  return [...best.values()];
}

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

  const all = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  // Validate scraper output — silently drop entries with NaN prices or empty names.
  const valid = validateSearchResults(all);

  // EAN-matched results are always relevant; apply relevance filter only to
  // text-search results (those without an `ean` field set)
  const filtered = valid.filter(
    (r) => r.ean !== undefined || isRelevant(r.productName, query),
  );

  const deduped = filterVariantConflicts(filtered, query);

  // Keep the best (cheapest per-unit) result per store so each store appears
  // at most once in the ranking. Multiple variants of the same product from the
  // same store are common (e.g. 48-ct vs 80-ct pack) but the comparison should
  // show one representative price per store, not inflate the result count.
  return deduplicateByStore(deduped).sort((a, b) => a.price - b.price);
}

/**
 * Streaming variant: resolves EANs once, then runs all scrapers in parallel,
 * calling `onBatch` as each scraper returns relevant results (allowing progressive UI).
 * Scraper errors are swallowed — they never block other scrapers.
 */
export async function streamSearchAllStores(
  query: string,
  onBatch: (results: SearchResult[]) => void,
): Promise<void> {
  const { eans } = await resolveProductEans(query);
  const ctx = { query, eans };

  await Promise.allSettled(
    activeScrapers.map(async (scraper) => {
      try {
        const results = await scraper.search(ctx);
        const valid = validateSearchResults(results);
        const relevant = valid.filter(
          (r) => r.ean !== undefined || isRelevant(r.productName, query),
        );
        const deduped = filterVariantConflicts(relevant, query);
        // Only the best per-unit result from this store goes to the stream.
        const best = deduplicateByStore(deduped);
        if (best.length > 0) {
          onBatch(best);
        }
      } catch {
        // individual scraper errors silently discarded
      }
    }),
  );
}
