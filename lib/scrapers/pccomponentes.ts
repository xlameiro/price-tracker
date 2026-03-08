import * as cheerio from "cheerio";
import type { PriceScraper, ScrapedPrice } from "./types";

export class PcComponentesScraper implements PriceScraper {
  readonly storeSlug = "pccomponentes";

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

      // PcComponentes price selectors
      const priceText =
        $("[class*='PriceMain']").first().text().trim() ||
        $("[class*='price-final']").first().text().trim() ||
        $(".price-section .price").first().text().trim();

      if (!priceText) return null;

      const priceMatch = /[\d,.]+/.exec(priceText.replace(/\s/g, ""));
      if (!priceMatch) return null;

      const price = Number.parseFloat(
        priceMatch[0].replace(/\./g, "").replace(",", "."),
      );
      if (!Number.isFinite(price) || price <= 0) return null;

      const isAvailable =
        $("button[data-testid*='cart']").length > 0 ||
        $("[class*='add-to-cart']").length > 0 ||
        $("[class*='AddToCart']").length > 0;

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
