import { describe, expect, it } from "vitest";
import {
  comparablePrice,
  inferComparisonMode,
  quantityLabel,
} from "@/lib/price-comparison";
import { AhorramasSearchScraper } from "./ahorramas-search";
import { AlcampoSearchScraper } from "./alcampo-search";
import { AldiSearchScraper } from "./aldi-search";
import { AmazonSearchScraper } from "./amazon-search";
import { BmSearchScraper } from "./bm-search";
import { CarrefourSearchScraper } from "./carrefour-search";
import { ElCorteInglesSearchScraper } from "./elcorteingles-search";
import { EroskiSearchScraper } from "./eroski-search";
import { FroizSearchScraper } from "./froiz-search";
import { GadisSearchScraper } from "./gadis-search";
import { HipercorSearchScraper } from "./hipercor-search";
import { MercadonaSearchScraper } from "./mercadona-search";
import { SupermercadoFamiliaSearchScraper } from "./supermercado-familia-search";
import type { SearchResult, StoreSearchScraper } from "./types";

// Only scrapers expected to carry "queso larsa" (food retailers, no pharma)
const FOOD_SCRAPERS: StoreSearchScraper[] = [
  new AhorramasSearchScraper(),
  new AlcampoSearchScraper(),
  new AldiSearchScraper(),
  new AmazonSearchScraper(),
  new BmSearchScraper(),
  new CarrefourSearchScraper(),
  new ElCorteInglesSearchScraper(),
  new EroskiSearchScraper(),
  new FroizSearchScraper(),
  new GadisSearchScraper(),
  new HipercorSearchScraper(),
  new MercadonaSearchScraper(),
  new SupermercadoFamiliaSearchScraper(),
];

const QUERY = "queso larsa";

describe(`Diagnóstico: "${QUERY}"`, () => {
  it("muestra ranking con precios unitarios y expone scrappers con cantidad vacía", async () => {
    const ctx = { query: QUERY, eans: [] as string[] };
    const allResults: Array<{ store: string; item: SearchResult }> = [];

    await Promise.allSettled(
      FOOD_SCRAPERS.map(async (scraper) => {
        try {
          const items = await scraper.search(ctx);
          for (const item of items) {
            allResults.push({ store: scraper.storeName, item });
          }
        } catch (e) {
          console.error(
            `❌ ${scraper.storeName}:`,
            e instanceof Error ? e.message : e,
          );
        }
      }),
    );

    const items = allResults.map((r) => r.item);
    const mode = inferComparisonMode(items);

    allResults.sort((a, b) => {
      const ca = comparablePrice(a.item, mode, true);
      const cb = comparablePrice(b.item, mode, true);
      if (ca !== null && cb !== null) return ca - cb;
      if (ca === null && cb === null) return a.item.price - b.item.price;
      return ca === null ? 1 : -1;
    });

    const withUnitPrice = allResults.filter(
      ({ item }) => comparablePrice(item, mode, true) !== null,
    );
    const withoutUnitPrice = allResults.filter(
      ({ item }) => comparablePrice(item, mode, true) === null,
    );

    console.log(`\n${"=".repeat(70)}`);
    console.log(`  RANKING: "${QUERY}"`);
    console.log(
      `  Modo: ${mode}   Total: ${allResults.length}   Con precio/kg: ${withUnitPrice.length}   Sin: ${withoutUnitPrice.length}`,
    );
    console.log("=".repeat(70));

    let rank = 1;
    for (const { store, item } of allResults) {
      const up = comparablePrice(item, mode, true);
      const upStr =
        up !== null
          ? `${(up * 10).toFixed(2)} €/kg` // ×10 = per-kg preview
          : "⚠️  null";
      const qty = quantityLabel(item);
      const flag = up === null ? "⚠️ " : `#${rank++} `;
      console.log(
        `${flag}[${store}] ${item.productName}\n` +
          `   precio: ${item.price.toFixed(2)} €   qty: ${qty}   ${upStr}\n` +
          `   pkg=${String(item.packageSize ?? "—")} nw=${item.netWeight ?? "—"}${item.netWeightUnit ?? ""}`,
      );
    }

    if (withoutUnitPrice.length > 0) {
      console.log(
        `\n⚠️  ${withoutUnitPrice.length} resultado(s) SIN cantidad — columna vacía en la app:`,
      );
      for (const { store, item } of withoutUnitPrice) {
        console.log(
          `   [${store}] "${item.productName}"\n` +
            `   → pkg=${String(item.packageSize ?? "—")} nw=${item.netWeight ?? "—"}${item.netWeightUnit ?? ""}\n` +
            `   → NECESITA extracción del body del PDP`,
        );
      }
    }
    console.log("=".repeat(70));
    expect(allResults.length).toBeGreaterThan(0);
  }, 120_000);
});
