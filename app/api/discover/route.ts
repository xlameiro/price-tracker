import { fail, ok, verifyCronSecret } from "@/lib/api";
import { db } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import { searchAllStores } from "@/lib/scrapers/search";
import type { NextRequest } from "next/server";

// POST /api/discover — run search scrapers for every active product and save
// the results as new priceEntry records.
//
// Why this endpoint exists
// ────────────────────────
// The /api/scrape cron only *refreshes* already-known price entries: it reads
// priceEntries that have a stored `url` and re-scrapes them. On a fresh
// database (or for new products) there are no entries yet, so /api/scrape is a
// no-op and every product page shows "0 tiendas".
//
// This endpoint plugs the gap: it queries all stores by product name, lets the
// relevance filter discard unrelated results, and writes one priceEntry per
// matched (product, store) pair. After the first run /api/scrape can take over
// for daily refreshes.
//
// Protected by SCRAPE_CRON_SECRET. Intended to be called:
//   • Manually once after a deploy / seed to bootstrap price data.
//   • Via a weekly Vercel cron job to pick up products added since the last discovery.

type DiscoverProductResult = {
  productSlug: string;
  discovered: number;
  stores: string[];
};

export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) throw new AuthenticationError();

    // ?cleanup=1 — delete all existing SCRAPE entries for each product
    // before (re-)discovering. Use this to purge stale/wrong entries after
    // improving the relevance filter. Historical MANUAL entries are kept.
    const cleanup = request.nextUrl.searchParams.get("cleanup") === "1";

    const startedAt = new Date().toISOString();

    // Load all active products and stores in one round-trip each.
    const [products, stores] = await Promise.all([
      db.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
      }),
      db.store.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      }),
    ]);

    // Index stores by slug for O(1) lookup per result.
    const storeBySlug = new Map(stores.map((s) => [s.slug, s]));

    let totalDeleted = 0;
    let totalDiscovered = 0;
    const perProduct: DiscoverProductResult[] = [];

    for (const product of products) {
      if (cleanup) {
        const { count } = await db.priceEntry.deleteMany({
          where: { productId: product.id, source: "SCRAPE" },
        });
        totalDeleted += count;
      }

      // searchAllStores applies the relevance filter internally and
      // returns at most 5 results per store (≤ STORE_COUNT × 5 total).
      const results = await searchAllStores(product.name);

      const storeNames: string[] = [];
      let productDiscovered = 0;

      for (const result of results) {
        const store = storeBySlug.get(result.storeSlug);
        // Skip results whose storeSlug is not in the DB (future-proofing).
        if (!store) continue;

        await db.priceEntry.create({
          data: {
            productId: product.id,
            storeId: store.id,
            price: result.price,
            currency: result.currency,
            url: result.productUrl ?? null,
            source: "SCRAPE",
            isAvailable: result.isAvailable,
            packageSize: result.packageSize ?? null,
          },
        });

        productDiscovered++;
        storeNames.push(result.storeName);
      }

      totalDiscovered += productDiscovered;
      perProduct.push({
        productSlug: product.slug,
        discovered: productDiscovered,
        stores: storeNames,
      });
    }

    return ok({
      message: "Discovery completed",
      cleanup,
      totalDeleted: cleanup ? totalDeleted : undefined,
      totalDiscovered,
      products: products.length,
      startedAt,
      finishedAt: new Date().toISOString(),
      perProduct,
    });
  } catch (error) {
    return fail(error);
  }
}
