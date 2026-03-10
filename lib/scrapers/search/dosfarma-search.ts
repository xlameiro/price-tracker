import { parseProductQuantity } from "./scraper-utils";
import type { SearchContext, SearchResult, StoreSearchScraper } from "./types";

// dosfarma.com uses Magento 2 with Algolia InstantSearch for product search.
// The Algolia credentials (applicationId + search-only API key) are embedded in
// window.algoliaConfig on every page load. The API key is a secured Algolia key
// (Base64-encoded with tagFilters restriction) — safe to use in server-side calls.
//
// Index name pattern: pro_dosfarma_es_products
//
// Quantity extraction: Algolia returns structured fields:
//   content_size: "90.0000 Piece" | "500.0000 Milliliter" | "250.0000 Gram" | …
//   content_size_factor: 2  (multi-pack multiplier, e.g. 2 for a 2×78-unit combipack)
// These are used in preference to regex-based parsing of the product name.

const APP_ID = "5FYR88UN93";
const API_KEY =
  "MDcyZWIyZjVlOTk0YzRjMDg2ZTBiNmUzZTcyNWE3YjZhMGZkOWQwYmQ0NzE0NDcwNTc4MWI2ZTFmMzBmMGRmMHRhZ0ZpbHRlcnM9";
const INDEX = "pro_dosfarma_es_products";
const ALGOLIA_URL = `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX}/query`;

type AlgoliaHit = {
  name: string;
  price: { EUR: { default: number } };
  url: string;
  image_url?: string;
  /** e.g. "90.0000 Piece", "500.0000 Milliliter", "250.0000 Gram", "1.0000 Kilogram" */
  content_size?: string;
  /** Multi-pack multiplier — 2 means the pack contains 2 × content_size units */
  content_size_factor?: number;
};

type AlgoliaResponse = {
  hits: AlgoliaHit[];
  nbHits: number;
};

type QuantityFields = Pick<
  SearchResult,
  "packageSize" | "netWeight" | "netWeightUnit"
>;

/**
 * Resolve quantity from Algolia structured fields.
 * Falls back to regex-based name parsing when content_size is absent.
 * Exported for unit testing.
 */
export function resolveDosFarmaQuantity(
  hit: AlgoliaHit,
): Partial<QuantityFields> {
  const { content_size, content_size_factor, name } = hit;
  if (!content_size) return parseProductQuantity(name);

  const m = /^([\d.]+)\s+(\w+)$/.exec(content_size.trim());
  if (!m) return parseProductQuantity(name);

  const value = Number.parseFloat(m[1]);
  const unit = m[2].toLowerCase().replace(/s$/, ""); // "Pieces" → "piece"
  const factor = content_size_factor ?? 1;

  return contentSizeToQuantity(value, unit, factor);
}

function contentSizeToQuantity(
  value: number,
  unit: string,
  factor: number,
): Partial<QuantityFields> {
  if (unit === "piece") {
    return { packageSize: Math.round(value * factor) };
  }
  if (unit === "milliliter") {
    return factor > 1
      ? {
          packageSize: factor,
          netWeight: Math.round(value),
          netWeightUnit: "ml",
        }
      : { netWeight: Math.round(value), netWeightUnit: "ml" };
  }
  if (unit === "liter") {
    return factor > 1
      ? {
          packageSize: factor,
          netWeight: Math.round(value * 1000),
          netWeightUnit: "ml",
        }
      : { netWeight: Math.round(value * 1000), netWeightUnit: "ml" };
  }
  if (unit === "gram") {
    return factor > 1
      ? {
          packageSize: factor,
          netWeight: Math.round(value),
          netWeightUnit: "g",
        }
      : { netWeight: Math.round(value), netWeightUnit: "g" };
  }
  if (unit === "kilogram") {
    return factor > 1
      ? {
          packageSize: factor,
          netWeight: Math.round(value * 1000),
          netWeightUnit: "g",
        }
      : { netWeight: Math.round(value * 1000), netWeightUnit: "g" };
  }
  return {};
}

export class DosFarmaSearchScraper implements StoreSearchScraper {
  readonly storeSlug = "dosfarna"; // legacy slug kept to avoid DB migration
  readonly storeName = "DosFarma";

  async search({ query }: SearchContext): Promise<SearchResult[]> {
    let data: AlgoliaResponse;
    try {
      const response = await fetch(ALGOLIA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Algolia-Application-Id": APP_ID,
          "X-Algolia-API-Key": API_KEY,
        },
        body: JSON.stringify({ query, hitsPerPage: 5 }),
      });
      if (!response.ok) return [];
      data = (await response.json()) as AlgoliaResponse;
    } catch {
      return [];
    }

    return data.hits.map((hit) => ({
      storeSlug: this.storeSlug,
      storeName: this.storeName,
      productName: hit.name,
      price: hit.price.EUR.default,
      currency: "EUR",
      imageUrl: hit.image_url ?? null,
      productUrl: hit.url,
      isAvailable: true,
      ...resolveDosFarmaQuantity(hit),
    }));
  }
}
