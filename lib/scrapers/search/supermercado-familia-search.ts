import * as cheerio from "cheerio";
import { resolveGtmItemQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// supermercadofamilia.com is dead (DNS fails). The store moved to familiaonline.es
// (Autoservicios Familia / Vegalsa-Eroski group). familiaonline.es uses the same
// Apache Tapestry platform as eroski-search.ts: product data is embedded as
// HTML-entity-encoded JSON in [data-metrics] attributes on each product link.
// The search results page is a plain GET — no session cookie required.
const BASE_URL = "https://www.familiaonline.es";

export class SupermercadoFamiliaSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "supermercado-familia";
  readonly storeName = "Supermercado Familia";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      // Normalise to plain ASCII: familiaonline.es returns 404 when the query
      // contains UTF-8 percent-encoded characters such as ñ (%C3%B1).
      const normalisedQuery = query
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const response = await fetch(
        `${BASE_URL}/es/search/results/?q=${encodeURIComponent(normalisedQuery)}&suggestionsFilter=false`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const seen = new Set<string>();
      const results: SearchResult[] = [];

      // Each product appears twice (desktop + mobile views); deduplicate by item_id.
      $("a.product-title-link[data-metrics]").each((_, el) => {
        const metricsRaw = $(el).attr("data-metrics");
        if (!metricsRaw) return;

        let metrics: {
          ecommerce?: { items?: Array<Record<string, unknown>> };
        };
        try {
          metrics = JSON.parse(metricsRaw) as typeof metrics;
        } catch {
          return;
        }

        const items = metrics.ecommerce?.items;
        if (!items?.length) return;

        const item = items[0];
        const id = item["item_id"] as string | undefined;
        if (!id || seen.has(id)) return;
        seen.add(id);

        const productName = item["item_name"] as string | undefined;
        const price = item["price"] as number | undefined;
        if (!productName || price == null || price <= 0) return;

        const productUrl =
          ($(el).attr("href") ?? "").replace(":443", "") ||
          `${BASE_URL}/es/productdetail/${id}/`;

        results.push({
          storeSlug: this.storeSlug,
          storeName: this.storeName,
          productName,
          price,
          currency: "EUR",
          imageUrl: `${BASE_URL}/images/${id}.jpg`,
          productUrl,
          isAvailable: true,
          ...resolveGtmItemQuantity(
            productName,
            item["item_variant"] as string | undefined,
          ),
        } satisfies SearchResult);

        if (results.length >= 5) return false;
      });

      return results;
    } catch {
      return [];
    }
  }
}
