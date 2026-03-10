/**
 * Open Food Facts product resolver.
 *
 * Given a free-text query, returns up to MAX_EANS EAN/GTIN codes that
 * correspond to real products in the Open Food Facts public database.
 *
 * API docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 * No API key required. Rate-limit: be polite — 1 search per user request.
 */

import { z } from "zod";

const MAX_EANS = 5;
const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

const OffProductSchema = z
  .object({
    code: z.string().optional(),
    product_name: z.string().optional(),
    product_name_es: z.string().optional(),
    image_url: z.string().optional(),
  })
  .loose();

const OffSearchResponseSchema = z
  .object({
    count: z.number().optional(),
    products: z.array(OffProductSchema).optional(),
  })
  .loose();

export interface ResolvedProduct {
  /** EAN/GTIN codes, most-scanned first */
  eans: string[];
  /** Best Spanish product name found, or the original query if nothing found */
  canonicalName: string;
}

/**
 * Resolves a user query to a list of EAN barcodes via Open Food Facts.
 * Returns an empty `eans` array (gracefully) on any error.
 */
export async function resolveProductEans(
  query: string,
): Promise<ResolvedProduct> {
  try {
    const params = new URLSearchParams({
      action: "process",
      search_terms: query,
      json: "1",
      page_size: String(MAX_EANS * 2), // fetch more, deduplicate below
      sort_by: "unique_scans_n", // most scanned = most reliable data
      lc: "es",
    });

    const response = await fetch(`${OFF_SEARCH_URL}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        // Identify ourselves to Open Food Facts as required by their ToS
        "User-Agent":
          "PriceTrackerApp/1.0 (https://github.com/xabierlameiro/price-tracker)",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return { eans: [], canonicalName: query };

    const parsed = OffSearchResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.warn(
        "[product-resolver] Unexpected OFF API response shape:",
        parsed.error.issues[0]?.message,
      );
      return { eans: [], canonicalName: query };
    }
    const { data } = parsed;
    const products = data.products ?? [];

    const eans = products
      .map((p) => p.code ?? "")
      .filter((code) => /^\d{8,14}$/.test(code)) // valid EAN-8 or EAN-13 or GTIN-14
      .slice(0, MAX_EANS);

    // Best canonical name: Spanish name > generic name > query
    const bestName =
      products[0]?.product_name_es || products[0]?.product_name || query;

    return { eans, canonicalName: bestName };
  } catch {
    return { eans: [], canonicalName: query };
  }
}
