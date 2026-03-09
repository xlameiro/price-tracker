import * as cheerio from "cheerio";
import { parseProductQuantity, fetchHtml } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

export class AhorramasSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "ahorramas";
  readonly storeName = "Ahorramas";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    const html = await fetchHtml(
      `https://www.ahorramas.com/buscador?q=${encodeURIComponent(query)}`,
    );
    if (!html) return [];

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".product-tile").each((_, el) => {
      const item = $(el);
      const productName = item.find(".product-name-gtm").first().text().trim();
      if (!productName) return;

      const priceContent = item
        .find(".price .sales .value")
        .first()
        .attr("content");
      const price = Number.parseFloat(priceContent ?? "");
      if (!Number.isFinite(price) || price <= 0) return;

      const href = item.find("a").first().attr("href") ?? "";
      const productUrl = href.startsWith("http")
        ? href
        : `https://www.ahorramas.com${href}`;
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
