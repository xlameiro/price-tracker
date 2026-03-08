import * as cheerio from "cheerio";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

type AlcampoProduct = {
  name?: string;
  price?: number;
  urlPath?: string;
  thumbnail?: string;
};

function parseAlcampoNextData(
  html: string,
  storeSlug: string,
  storeName: string,
): SearchResult[] {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").html();
  if (!raw) return [];

  const data = JSON.parse(raw) as {
    props?: { pageProps?: { products?: AlcampoProduct[] } };
  };
  return (data.props?.pageProps?.products ?? []).slice(0, 5).flatMap((p) => {
    if (!p.name || !p.price) return [];
    return [
      {
        storeSlug,
        storeName,
        productName: p.name,
        price: p.price,
        currency: "EUR",
        imageUrl: p.thumbnail ?? null,
        productUrl: `https://www.alcampo.es${p.urlPath ?? ""}`,
        isAvailable: true,
      } satisfies SearchResult,
    ];
  });
}

export class AlcampoSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "alcampo";
  readonly storeName = "Alcampo";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `https://www.alcampo.es/compra-online/search/?q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) return [];

      const html = await response.text();
      try {
        const fromNext = parseAlcampoNextData(
          html,
          this.storeSlug,
          this.storeName,
        );
        if (fromNext.length > 0) return fromNext;
      } catch {
        // fall through
      }

      // HTML fallback
      const $ = cheerio.load(html);
      const results: SearchResult[] = [];
      $("[class*='product-item'], .product-tile").each((_, el) => {
        const item = $(el);
        const productName = item
          .find("[class*='product-name'], [class*='title']")
          .first()
          .text()
          .trim();
        if (!productName) return;

        const priceText = item
          .find("[class*='price']")
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
            : `https://www.alcampo.es${href}`,
          isAvailable: true,
        });
      });

      return results.slice(0, 5);
    } catch {
      return [];
    }
  }
}
