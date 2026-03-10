import * as cheerio from "cheerio";
import { browserClient, parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Lidl España — status: partial (SPA, products loaded by JavaScript)
//
// The search page at /q/buscar/?q=QUERY and /q/search/?q=QUERY is a Nuxt.js SPA.
// browserClient (impit) fetches the HTML successfully, but the product grid is
// populated client-side after JS execution — the server only returns a skeleton.
// window.__NUXT__ = {} (empty state) confirms no SSR product data is embedded.
//
// Known APIs investigated and unavailable via server-side fetch:
//   /q/storefront-dist/… — static JS bundle, no product JSON endpoint
//   /api/products/…      — 404
//   /es-es/search…       — 404
//
// Next step: add Playwright-based rendering once the scraper is deployed behind a
// browser-capable proxy, or reverse-engineer the internal Nuxt data fetch call.
//
// Until then this scraper is included in activeScrapers and returns best-effort
// results from any server-rendered product data present on the category page.

const SEARCH_URL = "https://www.lidl.es/q/search/?q=";

export class LidlSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "lidl";
  readonly storeName = "Lidl";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
      const response = await browserClient.fetch(url, { timeout: 12_000 });
      if (!response.ok && response.status !== 404) return [];

      const html = await response.text();
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      // Try JSON-LD product structured data (most reliable when present)
      $('script[type="application/ld+json"]').each((_, el) => {
        if (results.length >= 5) return;
        try {
          const raw = $(el).html() ?? "";
          const data = JSON.parse(raw) as {
            "@type"?: string;
            name?: string;
            offers?: { price?: number | string; priceCurrency?: string };
            image?: string;
            url?: string;
          };
          if (data["@type"] !== "Product") return;
          const productName = data.name;
          const rawPrice = data.offers?.price;
          const price =
            typeof rawPrice === "string"
              ? Number.parseFloat(rawPrice.replace(",", "."))
              : (rawPrice ?? 0);
          if (!productName || !Number.isFinite(price) || price <= 0) return;

          results.push({
            storeSlug: this.storeSlug,
            storeName: this.storeName,
            productName,
            price,
            currency: "EUR",
            imageUrl: data.image ?? null,
            productUrl: data.url ?? url,
            isAvailable: true,
            ...parseProductQuantity(productName),
          });
        } catch {
          // skip malformed JSON-LD
        }
      });

      // HTML fallback — selectors based on Lidl's Nuxt/ODS design system classes
      if (results.length === 0) {
        $(".product-grid-box, [class*='ProductCard'], article.product").each(
          (_, el) => {
            if (results.length >= 5) return;
            const item = $(el);
            const productName = item
              .find("[class*='title'], h2, h3")
              .first()
              .text()
              .trim();
            if (!productName) return;

            const priceText = item
              .find("[class*='price'], .m-price__price")
              .first()
              .text()
              .replace(/[^\d,]/g, "")
              .replace(",", ".");
            const price = Number.parseFloat(priceText);
            if (!Number.isFinite(price) || price <= 0) return;

            const href = item.find("a").first().attr("href") ?? "";
            const productUrl = href.startsWith("http")
              ? href
              : `https://www.lidl.es${href}`;

            results.push({
              storeSlug: this.storeSlug,
              storeName: this.storeName,
              productName,
              price,
              currency: "EUR",
              imageUrl: item.find("img").first().attr("src") ?? null,
              productUrl,
              isAvailable: true,
              ...parseProductQuantity(productName),
            });
          },
        );
      }

      return results;
    } catch {
      return [];
    }
  }
}
