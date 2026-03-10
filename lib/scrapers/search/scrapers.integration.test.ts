/**
 * Integration tests for all active search scrapers.
 *
 * These tests make REAL HTTP requests to store websites / APIs.
 * Run with:  pnpm test:integration
 * NOT in regular pnpm test (vitest.config.ts excludes *.integration.test.ts).
 *
 * For each scraper the test:
 *   1. Runs 13 diverse product queries concurrently (food, drinks, dairy, baby
 *      consumables, cleaning, hygiene, pharmacy).
 *   2. Validates every returned result against SearchResultSchema (Zod).
 *      → A result that fails the schema is a hard test failure.
 *   3. Prints a coverage report showing how many results have packageSize /
 *      netWeight populated, and the names of products that are missing quantity
 *      data — so we can diagnose parser gaps.
 *
 * A scraper returning 0 results for a query is NOT a failure: specialty stores
 * (pharmacies, baby shops) won't have food; supermarkets won't stock medicine.
 * A hard failure means: a result was returned but is structurally invalid.
 */

import { describe, expect, it } from "vitest";
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
import { PromoFarmaSearchScraper } from "./promofarma-search";
import { SupermercadoFamiliaSearchScraper } from "./supermercado-familia-search";
import type { SearchResult, StoreSearchScraper } from "./types";
import { SearchResultSchema } from "./types";
import { ViandviSearchScraper } from "./viandvi-search";

// ── Test product corpus ───────────────────────────────────────────────────────

/**
 * 13 queries covering diverse categories.
 * Each scraper type (supermarket / pharmacy / baby) will find results for the
 * subset that matches its catalogue.
 */
const TEST_PRODUCTS = [
  // Baby consumables
  { query: "pañales dodot talla 5", category: "consumibles bebé" },
  { query: "toallitas dodot pure aqua", category: "consumibles bebé" },
  // Dairy
  { query: "leche asturiana", category: "lácteos" },
  { query: "yogur dalky chocolate", category: "lácteos" },
  { query: "queso larsa", category: "lácteos" },
  // Food / grocery
  { query: "aceite oliva virgen extra carbonel", category: "alimentación" },
  { query: "patatas fritas ruffles", category: "snacks" },
  { query: "arroz largo SOS", category: "alimentación" },
  // Drinks
  { query: "agua mineral cabreiroa", category: "bebidas" },
  { query: "coca cola lata", category: "bebidas" },
  { query: "estrella galicia 0.0", category: "bebidas" },
  // Personal care / pharmacy
  { query: "desodorante AXE", category: "higiene" },
  { query: "ibuprofeno 400mg", category: "farmacia" },
] as const;

// ── Types for the per-query report ───────────────────────────────────────────

type QueryReport = {
  query: string;
  category: string;
  resultCount: number;
  validCount: number;
  withPackageSize: number;
  withNetWeight: number;
  /** Results that failed the Zod schema — always empty in a passing test run. */
  invalidItems: { result: SearchResult; errors: string }[];
  /**
   * Product names of valid results that have neither packageSize nor netWeight.
   * Useful for diagnosing parser gaps — not a failure, just diagnostic info.
   */
  missingQuantityNames: string[];
};

// ── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Run all TEST_PRODUCTS queries against a single scraper in parallel and
 * collect per-query reports.
 */
async function runAllQueries(
  scraper: StoreSearchScraper,
): Promise<QueryReport[]> {
  return await Promise.all(
    TEST_PRODUCTS.map(async ({ query, category }) => {
      let results: SearchResult[] = [];
      try {
        results = await scraper.search({ query, eans: [] });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`  ⚠️  [${scraper.storeSlug}] "${query}" threw: ${msg}`);
      }

      const invalidItems: QueryReport["invalidItems"] = [];
      const validResults: SearchResult[] = [];

      for (const item of results) {
        const parsed = SearchResultSchema.safeParse(item);
        if (parsed.success) {
          validResults.push(item);
        } else {
          invalidItems.push({
            result: item,
            errors: JSON.stringify(parsed.error.issues, null, 2),
          });
        }
      }

      return {
        query,
        category,
        resultCount: results.length,
        validCount: validResults.length,
        withPackageSize: validResults.filter((r) => r.packageSize !== undefined)
          .length,
        withNetWeight: validResults.filter((r) => r.netWeight !== undefined)
          .length,
        invalidItems,
        missingQuantityNames: validResults
          .filter(
            (r) => r.packageSize === undefined && r.netWeight === undefined,
          )
          .map((r) => r.productName)
          .slice(0, 5),
      } satisfies QueryReport;
    }),
  );
}

/**
 * Print a human-readable coverage summary for one scraper after its test runs.
 * Uses console.info so the output is visible in the integration test report.
 */
function printReport(
  storeSlug: string,
  storeName: string,
  reports: QueryReport[],
): void {
  const withResults = reports.filter((r) => r.resultCount > 0);
  const totalResults = reports.reduce((sum, r) => sum + r.validCount, 0);
  const totalPkg = reports.reduce((sum, r) => sum + r.withPackageSize, 0);
  const totalWeight = reports.reduce((sum, r) => sum + r.withNetWeight, 0);

  const pct = (n: number) =>
    totalResults > 0 ? `${Math.round((n / totalResults) * 100)}%` : "n/a";

  const header = `─`.repeat(Math.max(0, 40 - storeName.length));
  console.info(`\n┌── ${storeName} (${storeSlug}) ${header}`);
  console.info(
    `│  Queries with results: ${withResults.length} / ${reports.length}`,
  );
  console.info(`│  Total valid results:  ${totalResults}`);
  if (totalResults > 0) {
    console.info(`│  packageSize coverage: ${totalPkg} (${pct(totalPkg)})`);
    console.info(
      `│  netWeight coverage:   ${totalWeight} (${pct(totalWeight)})`,
    );
  }

  for (const r of withResults) {
    const qtyTag =
      r.withPackageSize > 0 || r.withNetWeight > 0
        ? `📦${r.withPackageSize} ⚖️${r.withNetWeight}`
        : "— no qty data";
    console.info(
      `│  "${r.query}" [${r.category}]: ${r.validCount} results ${qtyTag}`,
    );
    if (r.missingQuantityNames.length > 0) {
      const names = r.missingQuantityNames.map((n) => `"${n}"`).join(" | ");
      console.info(`│    └ missing qty: ${names}`);
    }
    for (const { result, errors } of r.invalidItems) {
      console.error(`│  ❌ SCHEMA INVALID:`);
      console.error(`│     result: ${JSON.stringify(result)}`);
      console.error(`│     errors: ${errors}`);
    }
  }

  console.info(`└${"─".repeat(52)}`);
}

// ── Shared assertion helper ───────────────────────────────────────────────────

function assertNoSchemaFailures(
  storeName: string,
  reports: QueryReport[],
): void {
  const failures = reports.flatMap((r) =>
    r.invalidItems.map(({ result, errors }) => ({
      query: r.query,
      result,
      errors,
    })),
  );

  if (failures.length === 0) return;

  const lines = failures.map(
    ({ query, result, errors }) =>
      `\n  Query: "${query}"\n  Result: ${JSON.stringify(result)}\n  Errors: ${errors}`,
  );
  expect.fail(
    `[${storeName}] ${failures.length} result(s) failed SearchResultSchema:\n${lines.join("\n")}`,
  );
}

// ── Per-scraper tests ─────────────────────────────────────────────────────────

describe("Mercadona", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new MercadonaSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Eroski", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new EroskiSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Carrefour", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new CarrefourSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Alcampo", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new AlcampoSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("El Corte Inglés", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new ElCorteInglesSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Hipercor", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new HipercorSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Ahorramas", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new AhorramasSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Gadis", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new GadisSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Froiz", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new FroizSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("BM Supermercados", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new BmSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Supermercado Familia", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new SupermercadoFamiliaSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Aldi", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new AldiSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Arenal", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new ArenalSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Primor", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new PrimorSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("DosFarma", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new DosFarmaSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Atida / MiFarma", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new AtidaSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Farmacias Direct", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new FarmaciasDirectSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("FarmaVázquez", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new FarmaVazquezSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Via&Vi", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new ViandviSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Amazon.es", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new AmazonSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Nappy", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new NappySearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("Más Pañales", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new MasPanalesSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});

describe("PromoFarma", () => {
  it("should return schema-valid results for diverse product queries", async () => {
    const scraper = new PromoFarmaSearchScraper();
    const reports = await runAllQueries(scraper);
    printReport(scraper.storeSlug, scraper.storeName, reports);
    assertNoSchemaFailures(scraper.storeName, reports);
  });
});
