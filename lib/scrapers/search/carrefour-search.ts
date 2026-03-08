import * as cheerio from "cheerio";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

type CarrefourItem = {
  id?: string;
  displayName?: string;
  price?: { value?: number };
  media?: Array<{ url?: string }>;
  slug?: string;
};

function parseCarrefourNextData(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const raw = $("#__NEXT_DATA__").html();
  if (!raw) return [];

  const data = JSON.parse(raw) as {
    props?: {
      pageProps?: {
        initialData?: { content?: Array<{ results?: CarrefourItem[] }> };
      };
    };
  };
  const items = data.props?.pageProps?.initialData?.content?.[0]?.results ?? [];

  return items.slice(0, 5).flatMap((item) => {
    const productName = item.displayName;
    const price = item.price?.value;
    if (!productName || !price) return [];
    const slug = item.slug ?? item.id ?? "";
    const productUrl = `https://www.carrefour.es${slug.startsWith("/") ? "" : "/"}${slug}`;
    return [
      {
        storeSlug: "carrefour",
        storeName: "Carrefour",
        productName,
        price,
        currency: "EUR",
        imageUrl: item.media?.[0]?.url ?? null,
        productUrl,
        isAvailable: true,
      } satisfies SearchResult,
    ];
  });
}

function parseCarrefourHtml($: cheerio.CheerioAPI): SearchResult[] {
  const results: SearchResult[] = [];
  $(".product-card, [class*='product-card']").each((_, el) => {
    const item = $(el);
    const productName = item
      .find("[class*='product-name'], [class*='displayName']")
      .first()
      .text()
      .trim();
    if (!productName) return;

    const priceText = item
      .find("[class*='price__integer'], [class*='price--current']")
      .first()
      .text()
      .replace(/[^\d,]/g, "")
      .replace(",", ".");
    const price = Number.parseFloat(priceText);
    if (!Number.isFinite(price) || price <= 0) return;

    const href = item.find("a").first().attr("href") ?? "";
    results.push({
      storeSlug: "carrefour",
      storeName: "Carrefour",
      productName,
      price,
      currency: "EUR",
      imageUrl: item.find("img").first().attr("src") ?? null,
      productUrl: href.startsWith("http")
        ? href
        : `https://www.carrefour.es${href}`,
      isAvailable: true,
    });
  });
  return results.slice(0, 5);
}

export class CarrefourSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "carrefour";
  readonly storeName = "Carrefour";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      const url = `https://www.carrefour.es/search/maxi/${encodeURIComponent(query)}?lang=es`;
      const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return [];

      const html = await response.text();
      try {
        const fromNext = parseCarrefourNextData(html);
        if (fromNext.length > 0) return fromNext;
      } catch {
        // fall through to HTML
      }
      return parseCarrefourHtml(cheerio.load(html));
    } catch {
      return [];
    }
  }
}
