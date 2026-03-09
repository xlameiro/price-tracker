import * as cheerio from "cheerio";
import type { ParsedQuantity } from "./scraper-utils";
import { browserClient, parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// Metadata collected from the SERP before we fetch the real price from each PDP.
interface SerpCandidate {
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  parsedQty: ParsedQuantity;
}

const PRICE_RE = /^(\d{1,6})[,.](\d{2})/;
const A_OFFSCREEN = ".a-offscreen";
const A_NOT_LIST_PRICE = ":not(.a-text-price)";

function parseOffscreen(text: string): number | null {
  const m = PRICE_RE.exec(text);
  if (!m) return null;
  return Number.parseInt(`${m[1]}${m[2]}`, 10) / 100;
}

function parsePriceFromEl(
  priceEl: ReturnType<ReturnType<typeof cheerio.load>>,
): number | null {
  const offscreen = priceEl.find(A_OFFSCREEN).first().text().trim();
  if (offscreen) return parseOffscreen(offscreen);
  const whole = priceEl
    .find(".a-price-whole")
    .first()
    .text()
    .replace(/[.,]/g, "")
    .trim();
  const fraction = priceEl.find(".a-price-fraction").first().text().trim();
  if (!whole) return null;
  return Number.parseInt(`${whole}${fraction || "00"}`, 10) / 100;
}

function parseSnsPrice(
  $: ReturnType<typeof cheerio.load>,
  regularPrice: number,
): number | undefined {
  const snsSelectors = [
    // Current Amazon.es layout (2026): accordion row + dedicated price element
    `#sns-base-price .a-price${A_NOT_LIST_PRICE}`,
    `#snsAccordionRowMiddle .a-price${A_NOT_LIST_PRICE}`,
    // Legacy / alternate layouts
    `#sns-price .a-price${A_NOT_LIST_PRICE}`,
    `#snsDetailPageContainer .a-price${A_NOT_LIST_PRICE}`,
    `.reinventSnsTileVariant .a-price${A_NOT_LIST_PRICE}`,
    `[data-feature-name='snsTileInlineBeta'] .a-price${A_NOT_LIST_PRICE}`,
    `[data-feature-name='snsBuyingOption'] .a-price${A_NOT_LIST_PRICE}`,
  ];
  for (const selector of snsSelectors) {
    const el = $(selector).first();
    if (!el.length) continue;
    const candidate = parseOffscreen(
      el.find(A_OFFSCREEN).first().text().trim(),
    );
    if (
      candidate &&
      Number.isFinite(candidate) &&
      candidate > 0 &&
      candidate < regularPrice
    ) {
      return candidate;
    }
  }
  return undefined;
}

// Parse the regular price and the Subscribe & Save price from an Amazon PDP.
// The PDP shows both prices even without a session:
//   • .priceToPay → standard single-purchase checkout price
//   • #sns-price / SNS widget  → recurring subscription price (lower)
async function fetchPdpPrice(productUrl: string): Promise<{
  price: number;
  subscribePrice?: number;
  isAvailable: boolean;
} | null> {
  try {
    const response = await browserClient.fetch(productUrl, { timeout: 10_000 });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // .priceToPay is the actual checkout price (older layout).
    // #corePrice_feature_div is the current (2026) layout.
    // .a-text-price marks the struck-through list price — always skip it.
    let priceEl = $(".priceToPay").first();
    if (!priceEl.length) {
      priceEl = $("#corePrice_feature_div .a-price")
        .not(A_NOT_LIST_PRICE)
        .first();
    }
    if (!priceEl.length) {
      priceEl = $("#corePriceDisplay_desktop_feature_div .a-price")
        .not(A_NOT_LIST_PRICE)
        .first();
    }
    if (!priceEl.length) priceEl = $(".a-price").not(A_NOT_LIST_PRICE).first();
    if (!priceEl.length) return null;

    const price = parsePriceFromEl(priceEl);
    if (!price || !Number.isFinite(price) || price <= 0) return null;

    const subscribePrice = parseSnsPrice($, price);
    const isAvailable =
      $("#add-to-cart-button").length > 0 || $("#buy-now-button").length > 0;

    return { price, subscribePrice, isAvailable };
  } catch {
    return null;
  }
}

export class AmazonSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "amazon-es";
  readonly storeName = "Amazon.es";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    try {
      // Phase 1: fetch the SERP to collect ASINs, names, images, and packageSizes.
      // We deliberately do NOT use the SERP price here — it only shows the
      // single-purchase price and never includes Subscribe & Save discounts.
      const serpUrl = `https://www.amazon.es/s?k=${encodeURIComponent(query)}&language=es_ES`;
      const serpResponse = await browserClient.fetch(serpUrl, {
        timeout: 10_000,
      });
      if (!serpResponse.ok) return [];

      const html = await serpResponse.text();
      const $ = cheerio.load(html);
      const candidates: SerpCandidate[] = [];

      // If the query specifies a size/variant (e.g. "Talla 5"), only keep SERP
      // results whose title contains the same size — avoids storing Talla 1
      // products when searching for Talla 5.
      const sizeMatch = /\btalla\s*(\d+)/i.exec(query);
      const sizeRe = sizeMatch
        ? new RegExp(`\\btalla\\s*${sizeMatch[1]}\\b`, "i")
        : null;

      $('[data-component-type="s-search-result"]').each((_, el) => {
        if (candidates.length >= 5) return false; // cheerio uses false to break

        const item = $(el);

        const h2El = item.find("h2").first();
        const productName = h2El.text().trim();
        if (!productName) return;

        // Skip wrong-size variants (e.g. Talla 1 when query asks for Talla 5)
        if (sizeRe && !sizeRe.test(productName)) return;

        const href =
          h2El.closest("a").attr("href") ??
          item.find('a[href*="/dp/"]').first().attr("href");
        if (!href) return;

        // Extract the bare ASIN and build a canonical PDP URL, stripping all
        // referral/tracking params (/ref=..., ?keywords=..., etc.).
        const asinMatch = /\/dp\/([A-Z0-9]{10})/i.exec(href);
        let productUrl: string;
        if (asinMatch) {
          productUrl = `https://www.amazon.es/dp/${asinMatch[1]}`;
        } else if (href.startsWith("http")) {
          productUrl = href;
        } else {
          productUrl = `https://www.amazon.es${href}`;
        }

        const imageUrl =
          item.find("img.s-image").attr("src") ??
          item.find("img").first().attr("src") ??
          null;

        candidates.push({
          productName,
          productUrl,
          imageUrl: imageUrl ?? null,
          parsedQty: parseProductQuantity(productName),
        });
      });

      if (candidates.length === 0) return [];

      // Phase 2: fetch each PDP in parallel to get the real checkout price.
      // This is the same strategy used by price-tracking sites like
      // CamelCamelCamel — the SERP never reflects Subscribe & Save pricing.
      const pdpResults = await Promise.all(
        candidates.map((c) => fetchPdpPrice(c.productUrl)),
      );

      const results: SearchResult[] = [];
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const pdp = pdpResults[i];
        if (!candidate || !pdp) continue;

        results.push({
          storeSlug: this.storeSlug,
          storeName: this.storeName,
          productName: candidate.productName,
          price: pdp.price,
          ...(pdp.subscribePrice !== undefined && {
            subscribePrice: pdp.subscribePrice,
          }),
          currency: "EUR",
          imageUrl: candidate.imageUrl,
          productUrl: candidate.productUrl,
          isAvailable: pdp.isAvailable,
          ...candidate.parsedQty,
        });
      }

      return results;
    } catch {
      return [];
    }
  }
}
