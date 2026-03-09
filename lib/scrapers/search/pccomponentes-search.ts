import * as cheerio from "cheerio";
import { browserClient } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

export class PcComponentesSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "pccomponentes";
  readonly storeName = "PcComponentes";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `https://www.pccomponentes.com/buscar/?query=${encodeURIComponent(query)}`;
      const response = await browserClient.fetch(url, { timeout: 10_000 });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $("article.product-card, [class*='ProductCard']").each((_, el) => {
        const item = $(el);

        const productName = item
          .find("[class*='product-card__title'], h3, .title")
          .first()
          .text()
          .trim();
        if (!productName) return;

        const priceText = item
          .find("[class*='price'], .precio")
          .first()
          .text()
          .replace(/[^\d,]/g, "")
          .replace(",", ".");
        const price = Number.parseFloat(priceText);
        if (!Number.isFinite(price) || price <= 0) return;

        const href = item.find("a").first().attr("href") ?? "";
        const productUrl = href.startsWith("http")
          ? href
          : `https://www.pccomponentes.com${href}`;
        const imageUrl =
          item.find("img").first().attr("src") ??
          item.find("img").first().attr("data-src") ??
          null;

        results.push({
          storeSlug: this.storeSlug,
          storeName: this.storeName,
          productName,
          price,
          currency: "EUR",
          imageUrl,
          productUrl,
          isAvailable: true,
        });
      });

      return results.slice(0, 5);
    } catch {
      return [];
    }
  }
}
