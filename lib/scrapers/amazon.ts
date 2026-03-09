import { browserClient } from "@/lib/scrapers/search/scraper-utils";
import * as cheerio from "cheerio";
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

      // Amazon assigns `.priceToPay` to the actual checkout price.
      // `.a-text-price` marks the struck-through "Precio único" (list price)
      // that often appears first in DOM order — we must skip it.
      // `.a-offscreen` contains the complete price string (e.g. "78,62 €")
      // which is more reliable than assembling whole + fraction spans because
      // Amazon occasionally nests extra spans inside `.a-price-whole`.
      let priceEl = $(".priceToPay").first();
      if (!priceEl.length) {
        priceEl = $("#corePriceDisplay_desktop_feature_div .a-price")
          .not(".a-text-price")
          .first();
      }
      if (!priceEl.length) {
        priceEl = $(".a-price").not(".a-text-price").first();
      }

      if (!priceEl.length) return null;

      // Prefer the clean offscreen text ("78,62 €"); fall back to whole/fraction.
      const offscreen = priceEl.find(".a-offscreen").first().text().trim();
      let price: number;

      if (offscreen) {
        // Pattern: digits, decimal separator (comma or dot), exactly two digits
        const PRICE_RE = /^(\d{1,6})[,.](\d{2})/;
        const match = PRICE_RE.exec(offscreen);
        if (!match) return null;
        price = Number.parseInt(`${match[1]}${match[2]}`, 10) / 100;
      } else {
        const priceWhole = priceEl.find(".a-price-whole").first().text().trim();
        const priceFraction = priceEl
          .find(".a-price-fraction")
          .first()
          .text()
          .trim();
        if (!priceWhole) return null;
        const rawPrice = `${priceWhole.replace(/[.,]/g, "")}${priceFraction || "00"}`;
        price = Number.parseInt(rawPrice, 10) / 100;
      }

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
