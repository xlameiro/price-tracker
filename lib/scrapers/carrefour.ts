import * as cheerio from "cheerio";
import type { PriceScraper, ScrapedPrice } from "./types";

export class CarrefourScraper implements PriceScraper {
  readonly storeSlug = "carrefour";

  async scrape(productUrl: string): Promise<ScrapedPrice | null> {
    try {
      const response = await fetch(productUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "es-ES,es;q=0.9",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) return null;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Carrefour price selectors
      const priceText =
        $("[class*='price__amount']").first().text().trim() ||
        $("[data-testid='price']").first().text().trim() ||
        $(".buybox__price").first().text().trim();

      if (!priceText) return null;

      const priceMatch = /[\d,]+/.exec(priceText.replace(/\s/g, ""));
      if (!priceMatch) return null;

      const price = Number.parseFloat(priceMatch[0].replace(",", "."));
      if (!Number.isFinite(price) || price <= 0) return null;

      const isAvailable =
        $("[class*='add-to-cart']").length > 0 ||
        $("button[data-testid*='add']").length > 0;

      return {
        price,
        currency: "EUR",
        url: productUrl,
        isAvailable,
      };
    } catch {
      return null;
    }
  }
}
