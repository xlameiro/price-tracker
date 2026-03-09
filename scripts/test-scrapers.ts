/**
 * Smoke-test all 24 active search scrapers against "Pañales Dodot Sensitive Talla 5".
 * Also probes raw HTTP status to distinguish "blocked" from "empty response".
 * Run with: pnpm tsx scripts/test-scrapers.ts
 */
import { Impit } from "impit";
import { AhorramasSearchScraper } from "../lib/scrapers/search/ahorramas-search";
import { AlcampoSearchScraper } from "../lib/scrapers/search/alcampo-search";
import { AldiSearchScraper } from "../lib/scrapers/search/aldi-search";
import { AmazonSearchScraper } from "../lib/scrapers/search/amazon-search";
import { ArenalSearchScraper } from "../lib/scrapers/search/arenal-search";
import { AtidaSearchScraper } from "../lib/scrapers/search/atida-search";
import { BmSearchScraper } from "../lib/scrapers/search/bm-search";
import { CarrefourSearchScraper } from "../lib/scrapers/search/carrefour-search";
import { DosFarmaSearchScraper } from "../lib/scrapers/search/dosfarma-search";
import { ElCorteInglesSearchScraper } from "../lib/scrapers/search/elcorteingles-search";
import { EroskiSearchScraper } from "../lib/scrapers/search/eroski-search";
import { FarmaciasDirectSearchScraper } from "../lib/scrapers/search/farmaciasdirect-search";
import { FarmaVazquezSearchScraper } from "../lib/scrapers/search/farmavazquez-search";
import { FroizSearchScraper } from "../lib/scrapers/search/froiz-search";
import { GadisSearchScraper } from "../lib/scrapers/search/gadis-search";
import { HipercorSearchScraper } from "../lib/scrapers/search/hipercor-search";
import { MasPanalesSearchScraper } from "../lib/scrapers/search/maspanales-search";
import { MercadonaSearchScraper } from "../lib/scrapers/search/mercadona-search";
import { NappySearchScraper } from "../lib/scrapers/search/nappy-search";
import { PrimorSearchScraper } from "../lib/scrapers/search/primor-search";
import { resolveProductEans } from "../lib/scrapers/search/product-resolver";
import { PromoFarmaSearchScraper } from "../lib/scrapers/search/promofarma-search";
import { SupermercadoFamiliaSearchScraper } from "../lib/scrapers/search/supermercado-familia-search";
import type { StoreSearchScraper } from "../lib/scrapers/search/types";
import { ViandviSearchScraper } from "../lib/scrapers/search/viandvi-search";

const QUERY = "Pañales Dodot Sensitive Talla 5";

// Separate impit instance for HTTP probes, distinct from the scrapers' shared
// browserClient — avoids concurrent-request pool exhaustion in impit.
const probeClient = new Impit({
  browser: "chrome",
  timeout: 8_000,
  headers: { "Accept-Language": "es-ES,es;q=0.9" },
});

// Map each scraper to its raw search URL so we can probe HTTP status independently
const SEARCH_URLS: Record<string, string> = {
  mercadona: `https://tienda.mercadona.es/api/search/?q=${encodeURIComponent("dodot talla 5")}&lang=es&wh=bcn1`,
  eroski: `https://supermercado.eroski.es/es/search/results/?q=dodot+sensitive+talla+5`,
  carrefour: `https://api.empathy.co/search/v1/query/carrefour/search?query=${encodeURIComponent(QUERY)}&lang=es&rows=1`,
  alcampo: `https://www.alcampo.es/compra-online/search?query=${encodeURIComponent(QUERY)}`,
  elcorteingles: `https://www.elcorteingles.es/supermercado/buscar/?term=${encodeURIComponent(QUERY)}`,
  hipercor: `https://www.hipercor.es/supermercado/buscar/?term=${encodeURIComponent(QUERY)}`,
  ahorramas: `https://www.ahorramas.com/buscar?q=${encodeURIComponent(QUERY)}`,
  gadis: `https://www.gadis.es/buscar?q=${encodeURIComponent(QUERY)}`,
  froiz: `https://api.empathy.co/search/v1/query/froiz/search?internal=true&query=panales+dodot&origin=url%3Aexternal&start=0&rows=5&instance=froiz&scope=desktop&lang=es&currency=EUR`,
  bm: `https://www.bmsupermercados.es/buscar?q=${encodeURIComponent(QUERY)}`,
  "supermercado-familia": `https://www.familiaonline.es/es/search/results/?q=${encodeURIComponent(QUERY)}&suggestionsFilter=false`,
  aldi: `https://www.aldi.es/busqueda.html?q=${encodeURIComponent(QUERY)}`,
  arenal: `https://www.arenal.net/search?q=${encodeURIComponent(QUERY)}`,
  primor: `https://www.primor.eu/buscar?controller=search&s=${encodeURIComponent(QUERY)}`,
  dosfarna: `https://www.dosfarma.com/catalogsearch/result/?q=${encodeURIComponent(QUERY)}`,
  atida: `https://www.atida.com/es-es/catalogsearch/result/?q=${encodeURIComponent(QUERY)}`,
  farmaciasdirect: `https://www.farmaciasdirect.com/buscar?q=${encodeURIComponent(QUERY)}`,
  farmavazquez: `https://eu1-search.doofinder.com/5/search?hashid=b8385fd3e2f32aadf43c359fb6791646&query=dodot&page=1&rpp=1&lang=es`,
  viandvi: `https://viandvi.es/wp-json/wc/store/v1/products?search=${encodeURIComponent(QUERY)}&per_page=1`,
  "amazon-es": `https://www.amazon.es/s?k=${encodeURIComponent(QUERY)}`,
  nappy: `https://nappy.es/module/iqitsearch/searchiqit?s=${encodeURIComponent(QUERY)}`,
  maspanales: `https://maspanales.com/module/iqitsearch/searchiqit?s=${encodeURIComponent(QUERY)}`,
  promofarma: `https://www.promofarma.com/search?q=${encodeURIComponent(QUERY)}`,
};

const scrapers: StoreSearchScraper[] = [
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

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function probeHttpStatus(
  storeSlug: string,
): Promise<{ status: number | "timeout" | "error" }> {
  const url = SEARCH_URLS[storeSlug];
  if (!url) return { status: "error" };
  try {
    // Use impit (Chrome TLS fingerprint) so sites that reject Node.js's native
    // TLS handshake still return a valid HTTP status code.
    const response = await probeClient.fetch(url, { timeout: 8_000 });
    return {
      status: response.status,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("timeout") || msg.includes("abort"))
      return { status: "timeout" };
    return { status: "error" };
  }
}

async function main() {
  console.log(`\nScraper smoke test — query: "${QUERY}"\n`);
  console.log("Resolving EANs first…");
  const { eans } = await resolveProductEans(QUERY);
  console.log(`EANs found: ${eans.length > 0 ? eans.join(", ") : "none"}\n`);

  const ctx = { query: QUERY, eans };

  let passed = 0;
  let blocked = 0;
  let empty = 0;
  let errors = 0;

  type Row = {
    store: string;
    slug: string;
    scraperResult: string;
    httpStatus: string;
    detail: string;
  };
  const rows: Row[] = [];

  for (const scraper of scrapers) {
    process.stdout.write(`  ${scraper.storeName.padEnd(24, ".")} `);

    // Run scraper and HTTP probe in parallel
    const [results, httpProbe] = await Promise.all([
      scraper.search(ctx).catch(() => []),
      probeHttpStatus(scraper.storeSlug),
    ]);

    const httpLabel =
      httpProbe.status === 200
        ? `${GREEN}HTTP 200${RESET}`
        : httpProbe.status === "timeout"
          ? `${YELLOW}TIMEOUT${RESET}`
          : httpProbe.status === "error"
            ? `${RED}CONN ERR${RESET}`
            : httpProbe.status >= 400
              ? `${RED}HTTP ${httpProbe.status}${RESET}`
              : `${YELLOW}HTTP ${httpProbe.status}${RESET}`;

    let scraperLabel: string;
    let detail: string;

    if (results.length > 0) {
      const best = results.sort((a, b) => a.price - b.price)[0];
      const unitPrice =
        best.packageSize && best.packageSize > 0
          ? ` = ${(best.price / best.packageSize).toFixed(3)}€/ud`
          : "";
      scraperLabel = `${GREEN}✅ ${results.length} results${RESET}`;
      detail = `"${best.productName.slice(0, 55)}" · ${best.price.toFixed(2)}€${unitPrice}${best.packageSize ? ` · ${best.packageSize}ud` : ""}`;
      passed++;
    } else if (httpProbe.status === 200) {
      scraperLabel = `${YELLOW}⚠️  no match${RESET}`;
      detail = "Page loaded but parser found nothing";
      empty++;
    } else if (httpProbe.status === "timeout") {
      scraperLabel = `${RED}⏱️  timeout${RESET}`;
      detail = "Request timed out (8s)";
      blocked++;
    } else {
      scraperLabel = `${RED}🚫 blocked/err${RESET}`;
      detail = `HTTP ${httpProbe.status}`;
      blocked++;
    }

    console.log(`${scraperLabel}  ${httpLabel}  ${DIM}${detail}${RESET}`);
    rows.push({
      store: scraper.storeName,
      slug: scraper.storeSlug,
      scraperResult: scraperLabel,
      httpStatus: httpLabel,
      detail,
    });
  }

  console.log(
    "\n─────────────────────────────────────────────────────────────────────",
  );
  console.log(`${GREEN}Con resultados:${RESET}        ${passed}`);
  console.log(
    `${YELLOW}HTTP 200 sin parser match:${RESET} ${empty}  ← parser fix needed`,
  );
  console.log(
    `${RED}Bloqueados/timeout/error:${RESET}  ${blocked}  ← bot protection or wrong URL`,
  );
  if (errors) console.log(`${RED}Errores de excepción:${RESET}     ${errors}`);
  console.log(
    "─────────────────────────────────────────────────────────────────────\n",
  );

  // Print per-row detail
  for (const row of rows) {
    console.log(`${CYAN}${row.store}${RESET} ${DIM}(${row.slug})${RESET}`);
    console.log(`  ${row.scraperResult}  ${row.httpStatus}`);
    console.log(`  ${DIM}${row.detail}${RESET}\n`);
  }
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
