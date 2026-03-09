import * as cheerio from "cheerio";
import { browserClient, extractPackageSize } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

export class AmazonSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "amazon-es";
  readonly storeName = "Amazon.es";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `https://www.amazon.es/s?k=${encodeURIComponent(query)}&language=es_ES`;
      const response = await browserClient.fetch(url, { timeout: 10_000 });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('[data-component-type="s-search-result"]').each((_, el) => {
        const item = $(el);

        // Amazon changed structure: h2 is now inside <a>, not the reverse
        const h2El = item.find("h2").first();
        const productName = h2El.text().trim();
        if (!productName) return;

        const href =
          h2El.closest("a").attr("href") ??
          item.find('a[href*="/dp/"]').first().attr("href");
        if (!href) return;
        // Extract the bare ASIN and build a canonical URL, discarding
        // referral/tracking params (/ref=..., ?keywords=..., etc.).
        // This ensures the stored URL is always a clean PDP link.
        const asinMatch = /\/dp\/([A-Z0-9]{10})/i.exec(href);
        let productUrl: string;
        if (asinMatch) {
          productUrl = `https://www.amazon.es/dp/${asinMatch[1]}`;
        } else if (href.startsWith("http")) {
          productUrl = href;
        } else {
          productUrl = `https://www.amazon.es${href}`;
        }

        // Amazon SERP renders the struck-through list price (.a-text-price)
        // before the sale price in DOM order on discounted products.
        // We must exclude .a-text-price to get the actual buybox price.
        const priceEl = item.find(".a-price").not(".a-text-price").first();
        const priceWhole = priceEl
          .find(".a-price-whole")
          .first()
          .text()
          .replace(/[.,]/g, "")
          .trim();
        const priceFraction = priceEl
          .find(".a-price-fraction")
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
          packageSize: extractPackageSize(productName),
        });
      });

      return results.slice(0, 5);
    } catch {
      return [];
    }
  }
}
