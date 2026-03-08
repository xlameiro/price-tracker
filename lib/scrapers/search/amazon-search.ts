import * as cheerio from "cheerio";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

export class AmazonSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "amazon-es";
  readonly storeName = "Amazon.es";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `https://www.amazon.es/s?k=${encodeURIComponent(query)}&language=es_ES`;
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('[data-component-type="s-search-result"]').each((_, el) => {
        const item = $(el);

        const titleEl = item.find("h2 a.a-link-normal span");
        const productName = titleEl.first().text().trim();
        if (!productName) return;

        const href = item.find("h2 a.a-link-normal").attr("href");
        if (!href) return;
        const productUrl = href.startsWith("http")
          ? href
          : `https://www.amazon.es${href}`;

        const priceWhole = item
          .find(".a-price .a-price-whole")
          .first()
          .text()
          .replace(/[.,]/g, "")
          .trim();
        const priceFraction = item
          .find(".a-price .a-price-fraction")
          .first()
          .text()
          .trim();
        if (!priceWhole) return;

        const price =
          Number.parseInt(`${priceWhole}${priceFraction || "00"}`, 10) / 100;
        if (!Number.isFinite(price) || price <= 0) return;

        const imageUrl =
          item.find("img.s-image").attr("src") ??
          item.find("img").first().attr("src") ??
          null;

        results.push({
          storeSlug: this.storeSlug,
          storeName: this.storeName,
          productName,
          price,
          currency: "EUR",
          imageUrl: imageUrl ?? null,
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
