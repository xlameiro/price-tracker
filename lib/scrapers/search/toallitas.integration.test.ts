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
import { LidlSearchScraper } from "./lidl-search";
import { MasPanalesSearchScraper } from "./maspanales-search";
import { MercadonaSearchScraper } from "./mercadona-search";
import { NappySearchScraper } from "./nappy-search";
import { PrimorSearchScraper } from "./primor-search";
import { PromoFarmaSearchScraper } from "./promofarma-search";
import { SupermercadoFamiliaSearchScraper } from "./supermercado-familia-search";
import type { SearchResult, StoreSearchScraper } from "./types";
import { ViandviSearchScraper } from "./viandvi-search";

const ALL_SCRAPERS: StoreSearchScraper[] = [
  new AhorramasSearchScraper(),
  new AlcampoSearchScraper(),
  new AldiSearchScraper(),
  new AmazonSearchScraper(),
  new ArenalSearchScraper(),
  new AtidaSearchScraper(),
  new BmSearchScraper(),
  new CarrefourSearchScraper(),
  new DosFarmaSearchScraper(),
  new ElCorteInglesSearchScraper(),
  new EroskiSearchScraper(),
  new FarmaciasDirectSearchScraper(),
  new FarmaVazquezSearchScraper(),
  new FroizSearchScraper(),
  new GadisSearchScraper(),
  new HipercorSearchScraper(),
  new LidlSearchScraper(),
  new MasPanalesSearchScraper(),
  new MercadonaSearchScraper(),
  new NappySearchScraper(),
  new PrimorSearchScraper(),
  new PromoFarmaSearchScraper(),
  new SupermercadoFamiliaSearchScraper(),
  new ViandviSearchScraper(),
];

const QUERY = "toallitas dodot pure aqua";

describe(`Diagnóstico: "${QUERY}"`, () => {
  it("muestra ranking con precios unitarios (misma lógica que la app)", async () => {
    const ctx = { query: QUERY, eans: [] as string[] };
    const allResults: Array<{ store: string; item: SearchResult }> = [];

    await Promise.allSettled(
      ALL_SCRAPERS.map(async (scraper) => {
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

    // Sort exactly like the app (unit price asc, nulls last → then raw price)
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
      `  Modo comparación: ${mode}   Total: ${allResults.length} resultados`,
    );
    console.log(
      `  Con precio unitario: ${withUnitPrice.length}   Sin: ${withoutUnitPrice.length}`,
    );
    console.log("=".repeat(70));

    let rank = 1;
    for (const { store, item } of allResults) {
      const up = comparablePrice(item, mode, true);
      const upStr = up !== null ? `${up.toFixed(4)}€` : "⚠️  null";
      const qty = quantityLabel(item);
      const flag = up === null ? "⚠️ " : `#${rank++} `;
      console.log(
        `${flag}[${store}] ${item.productName}\n` +
          `   precio: ${item.price.toFixed(2)}€   qty: ${qty}   ${mode}: ${upStr}`,
      );
    }

    if (withoutUnitPrice.length > 0) {
      console.log(
        `\n⚠️  ${withoutUnitPrice.length} resultado(s) sin precio unitario:`,
      );
      for (const { store, item } of withoutUnitPrice) {
        console.log(
          `   [${store}] "${item.productName}" — pkg=${String(item.packageSize)} nw=${String(item.netWeight)}${String(item.netWeightUnit ?? "")}`,
        );
      }
    }

    console.log("=".repeat(70));
    expect(allResults.length).toBeGreaterThan(0);
  }, 120_000);
});
