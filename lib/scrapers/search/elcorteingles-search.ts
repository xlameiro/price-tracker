import * as cheerio from "cheerio";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

export class ElCorteInglesSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "elcorteingles";
  readonly storeName = "El Corte Inglés";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `https://www.elcorteingles.es/supermercado/search/?term=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $(".product-card__wrapper, ._product-card, article[data-product]").each(
        (_, el) => {
          const item = $(el);

          const productName =
            item
              .find(".product-card__description, .product-title")
              .first()
              .text()
              .trim() ||
            item.find("[class*='description']").first().text().trim();
          if (!productName) return;

          const priceText = item
            .find(
              ".price__sell-price, .price-current, [class*='selling-price']",
            )
            .first()
            .text()
            .replace(/[^\d,]/g, "")
            .replace(",", ".");
          const price = Number.parseFloat(priceText);
          if (!Number.isFinite(price) || price <= 0) return;

          const href =
            item.find("a").first().attr("href") ??
            item.closest("a").attr("href") ??
            "";
          const productUrl = href.startsWith("http")
            ? href
            : `https://www.elcorteingles.es${href}`;
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
