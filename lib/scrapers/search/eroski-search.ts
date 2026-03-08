import * as cheerio from "cheerio";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

export class EroskiSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "eroski";
  readonly storeName = "Eroski";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `https://supermercado.eroski.es/es/search/results/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $(".product-item, .grid-product, [class*='productItem']").each(
        (_, el) => {
          const item = $(el);

          const productName = item
            .find(".product-description a, .product-name, [class*='name']")
            .first()
            .text()
            .trim();
          if (!productName) return;

          const priceText = item
            .find(".current-price, .price, [class*='price']")
            .first()
            .text()
            .replace(/[^\d,]/g, "")
            .replace(",", ".");
          const price = Number.parseFloat(priceText);
          if (!Number.isFinite(price) || price <= 0) return;

          const href = item.find("a").first().attr("href") ?? "";
          const productUrl = href.startsWith("http")
            ? href
            : `https://supermercado.eroski.es${href}`;
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
        },
      );

      return results.slice(0, 5);
    } catch {
      return [];
    }
  }
}
