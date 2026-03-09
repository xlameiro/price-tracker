import * as cheerio from "cheerio";
import { parseProductQuantity, fetchHtml } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

export class PromoFarmaSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "promofarma";
  readonly storeName = "PromoFarma";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const html = await fetchHtml(
      `https://www.promofarma.com/buscar?texto=${encodeURIComponent(query)}`,
    );
    if (!html) return [];

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".product-card, .product-item, [class*='product']").each((_, el) => {
      const item = $(el);
      const productName = item
        .find(".product-card__name, .product-name, h3, [class*='name']")
        .first()
        .text()
        .trim();
      if (!productName) return;

      const priceText = item
        .find(".product-card__price, .price, [class*='price']")
        .first()
        .text()
        .replace(/[^\d,]/g, "")
        .replace(",", ".");
      const price = Number.parseFloat(priceText);
      if (!Number.isFinite(price) || price <= 0) return;

      const href = item.find("a").first().attr("href") ?? "";
      const productUrl = href.startsWith("http")
        ? href
        : `https://www.promofarma.com${href}`;
      const imageUrl = item.find("img").first().attr("src") ?? null;

      results.push({
        storeSlug: this.storeSlug,
        storeName: this.storeName,
        productName,
        price,
        currency: "EUR",
        imageUrl,
        productUrl,
        isAvailable: true,
        ...parseProductQuantity(productName),
      });
    });

    return results.slice(0, 5);
  }
}
