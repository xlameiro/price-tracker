import * as cheerio from "cheerio";
import { parseProductQuantity, fetchHtml } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

export class PrimorSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "primor";
  readonly storeName = "Primor";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    // Magento 2 search endpoint
    const html = await fetchHtml(
      `https://www.primor.eu/es_es/catalogsearch/result/?q=${encodeURIComponent(query)}`,
    );
    if (!html) return [];

    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $("form.product-item").each((_, el) => {
      const item = $(el);

      const productName = item
        .find("a.product-item-link")
        .first()
        .text()
        .trim();
      if (!productName) return;

      const priceAmount = item
        .find("span[data-price-type='finalPrice']")
        .first()
        .attr("data-price-amount");
      const price = Number.parseFloat(priceAmount ?? "");
      if (!Number.isFinite(price) || price <= 0) return;

      const href = item.find("a.product-item-link").first().attr("href") ?? "";
      const productUrl = href.startsWith("http")
        ? href
        : `https://www.primor.eu${href}`;
      const imageUrl =
        item.find("img.product-image-photo").first().attr("src") ?? null;

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
