import * as cheerio from "cheerio";
import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const BASE_URL = "https://www.dia.es";

export class DiaSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "dia";
  readonly storeName = "Día";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    // Día renders search results server-side, so Cheerio scraping works.
    // Akamai bot protection is present, but the page is accessible with
    // standard browser User-Agent headers (no impit needed).
    const response = await fetch(
      `${BASE_URL}/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9",
        },
      },
    );

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    $('li[data-test-id="search-product-card-list-item"]').each((_, el) => {
      const li = $(el);
      const card = li.find('[data-test-id="product-card"]');

      // Use object_id as deduplication key (products appear once, but safe to guard).
      const objectId = card.attr("object_id");
      if (!objectId || seen.has(objectId)) return;
      seen.add(objectId);

      const productName = li
        .find(
          '[data-test-id="search-product-card-name"] .search-product-card__product-name',
        )
        .text()
        .trim();
      if (!productName) return;

      const priceText = li
        .find('[data-test-id="search-product-card-unit-price"]')
        .text()
        .replace(/[^\d,]/g, "")
        .replace(",", ".");
      const price = Number.parseFloat(priceText);
      if (!Number.isFinite(price) || price <= 0) return;

      const href =
        li
          .find('[data-test-id="search-product-card-image-url"]')
          .attr("href") ?? "";
      const productUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      const rawSrc =
        li.find('[data-test-id="search-product-card-image"]').attr("src") ?? "";
      let imageUrl: string | null = null;
      if (rawSrc) {
        imageUrl = rawSrc.startsWith("http") ? rawSrc : `${BASE_URL}${rawSrc}`;
      }

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
