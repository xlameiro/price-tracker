import { AhorramasSearchScraper } from "./ahorramas-search";
import { AlcampoSearchScraper } from "./alcampo-search";
import { AldiSearchScraper } from "./aldi-search";
import { AmazonSearchScraper } from "./amazon-search";
import { ArenalSearchScraper } from "./arenal-search";
import { AtidaSearchScraper } from "./atida-search";
import { BmSearchScraper } from "./bm-search";
import { CarrefourSearchScraper } from "./carrefour-search";
import { DosFarmaSearchScraper } from "./dosfarma-search";
import { ElCorteInglesSearchScraper } from "./elcorteingles-search";
import { EroskiSearchScraper } from "./eroski-search";
import { FarmaciasDirectSearchScraper } from "./farmaciasdirect-search";
import { FarmaVazquezSearchScraper } from "./farmavazquez-search";
import { FroizSearchScraper } from "./froiz-search";
import { GadisSearchScraper } from "./gadis-search";
import { HipercorSearchScraper } from "./hipercor-search";
import { MasPanalesSearchScraper } from "./maspanales-search";
import { MercadonaSearchScraper } from "./mercadona-search";
import { NappySearchScraper } from "./nappy-search";
import { PrimorSearchScraper } from "./primor-search";
import { resolveProductEans } from "./product-resolver";
import { PromoFarmaSearchScraper } from "./promofarma-search";
import { isRelevant } from "./relevance";
import { SupermercadoFamiliaSearchScraper } from "./supermercado-familia-search";
import type { SearchResult, StoreSearchScraper } from "./types";
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
  new PromoFarmaSearchScraper(),
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

  const all = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );

  // EAN-matched results are always relevant; apply relevance filter only to
  // text-search results (those without an `ean` field set)
  const filtered = all.filter(
    (r) => r.ean !== undefined || isRelevant(r.productName, query),
  );

  return filtered.sort((a, b) => a.price - b.price);
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
        const relevant = results.filter(
          (r) => r.ean !== undefined || isRelevant(r.productName, query),
        );
        if (relevant.length > 0) {
          onBatch(relevant);
        }
      } catch {
        // individual scraper errors silently discarded
      }
    }),
  );
}
