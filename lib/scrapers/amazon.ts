import * as cheerio from "cheerio";
import { browserClient } from "@/lib/scrapers/search/scraper-utils";
import type { PriceScraper, ScrapedPrice } from "./types";

export class AmazonScraper implements PriceScraper {
  readonly storeSlug = "amazon-es";

  async scrape(productUrl: string): Promise<ScrapedPrice | null> {
    try {
      // Use impit's Chrome TLS + header fingerprint — plain fetch is blocked by
      // Amazon's bot detection; impit emulates BoringSSL cipher suites and
      // auto-generates realistic sec-ch-ua / Sec-Fetch-* headers.
      const response = await browserClient.fetch(productUrl, {
        timeout: 10_000,
      });

      if (!response.ok) return null;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Primary price selector (buybox)
      const priceWhole = $(".a-price .a-price-whole").first().text().trim();
      const priceFraction = $(".a-price .a-price-fraction")
        .first()
        .text()
        .trim();

      if (!priceWhole) return null;

      const rawPrice = `${priceWhole.replace(/[.,]/g, "")}${priceFraction || "00"}`;
      const price = Number.parseInt(rawPrice, 10) / 100;

      if (!Number.isFinite(price) || price <= 0) return null;

      const isAvailable =
        $("#add-to-cart-button").length > 0 || $("#buy-now-button").length > 0;

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
