import * as cheerio from "cheerio";
import { browserClient } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

export class MediaMarktSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "mediamarkt";
  readonly storeName = "MediaMarkt";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      // MediaMarkt uses a JSON search API
      const url = `https://www.mediamarkt.es/es/search.html?query=${encodeURIComponent(query)}`;
      const response = await browserClient.fetch(url, { timeout: 10_000 });

      if (!response.ok) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      // MediaMarkt embeds product data in script tags as JSON-LD
      $('script[type="application/ld+json"]').each((_, el) => {
        if (results.length >= 5) return;
        try {
          const jsonText = $(el).html() ?? "";
          const data = JSON.parse(jsonText) as {
            "@type"?: string;
            name?: string;
            offers?: { price?: number | string };
            image?: string;
            url?: string;
          };
          if (data["@type"] !== "Product") return;
          const productName = data.name;
          const rawPrice = data.offers?.price;
          const price =
            typeof rawPrice === "string"
              ? Number.parseFloat(rawPrice)
              : (rawPrice ?? 0);
          if (!productName || !Number.isFinite(price) || price <= 0) return;

          const productUrl = data.url ?? url;
          results.push({
            storeSlug: this.storeSlug,
            storeName: this.storeName,
            productName,
            price,
            currency: "EUR",
            imageUrl: data.image ?? null,
            productUrl,
            isAvailable: true,
          });
        } catch {
          // skip malformed JSON-LD
        }
      });

      if (results.length === 0) {
        // HTML fallback
        $("[data-test='product-tile'], .product-wrapper").each((_, el) => {
          const item = $(el);
          const productName = item
            .find("[data-test='product-title'], .product-name, h2")
            .first()
            .text()
            .trim();
          if (!productName) return;

          const priceText = item
            .find("[data-test='product-price'], .price")
            .first()
            .text()
            .replace(/[^\d,]/g, "")
            .replace(",", ".");
          const price = Number.parseFloat(priceText);
          if (!Number.isFinite(price) || price <= 0) return;

          const href = item.find("a").first().attr("href") ?? "";
          results.push({
            storeSlug: this.storeSlug,
            storeName: this.storeName,
            productName,
            price,
            currency: "EUR",
            imageUrl: item.find("img").first().attr("src") ?? null,
            productUrl: href.startsWith("http")
              ? href
              : `https://www.mediamarkt.es${href}`,
            isAvailable: true,
          });
        });
      }

      return results.slice(0, 5);
    } catch {
      return [];
    }
  }
}
