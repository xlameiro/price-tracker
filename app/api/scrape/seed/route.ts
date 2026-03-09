import { fail, ok, verifyCronSecret } from "@/lib/api";
import { db } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import type { SearchResult } from "@/lib/scrapers/search";
import { searchAllStores } from "@/lib/scrapers/search";
import { PriceSource } from "@prisma/client";
import type { NextRequest } from "next/server";

type StoreMap = Map<string, { id: string; slug: string }>;

// Pick the cheapest search result per store slug.
function bestResultsByStore(
  results: SearchResult[],
): Map<string, SearchResult> {
  const best = new Map<string, SearchResult>();
  for (const result of results) {
    const existing = best.get(result.storeSlug);
    if (!existing || result.price < existing.price) {
      best.set(result.storeSlug, result);
    }
  }
  return best;
}

// Save one search result as a PriceEntry. Returns true if created, false if skipped.
async function saveEntry(
  productId: string,
  storeId: string,
  result: SearchResult,
  today: Date,
): Promise<boolean> {
  const alreadySeeded = await db.priceEntry.findFirst({
    where: { productId, storeId, scrapedAt: { gte: today } },
    select: { id: true },
  });
  if (alreadySeeded) return false;

  await db.priceEntry.create({
    data: {
      productId,
      storeId,
      price: result.price,
      currency: result.currency,
      url: result.productUrl,
      source: PriceSource.SCRAPE,
      isAvailable: result.isAvailable,
      packageSize: result.packageSize ?? null,
    },
  });
  return true;
}

// Seed one product: search all stores, save best result per store.
async function seedProduct(
  product: { id: string; name: string },
  storeBySlug: StoreMap,
  today: Date,
): Promise<{ created: number; skipped: number }> {
  const results = await searchAllStores(product.name);
  const bestByStore = bestResultsByStore(results);

  let created = 0;
  let skipped = 0;

  for (const [storeSlug, result] of bestByStore) {
    const store = storeBySlug.get(storeSlug);
    if (!store) continue;

    const wasCreated = await saveEntry(product.id, store.id, result, today);
    if (wasCreated) {
      created++;
    } else {
      skipped++;
    }
  }

  return { created, skipped };
}

// POST /api/scrape/seed — bootstrap PriceEntry records via search scrapers.
//
// Searches each active product in all stores and saves the cheapest result
// per store as an initial PriceEntry. Skips stores that already have an
// entry for that product today.
//
// Protected by SCRAPE_CRON_SECRET (same header as /api/scrape).
// Call this once after initial deploy, or whenever you add a new product.
export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) throw new AuthenticationError();

    const activeProducts = await db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
    });

    const stores = await db.store.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    });
    const storeBySlug: StoreMap = new Map(
      stores.map((store) => [store.slug, store]),
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const product of activeProducts) {
      const { created, skipped } = await seedProduct(
        product,
        storeBySlug,
        today,
      );
      totalCreated += created;
      totalSkipped += skipped;
    }

    return ok({ products: activeProducts.length, totalCreated, totalSkipped });
  } catch (error) {
    return fail(error);
  }
}
