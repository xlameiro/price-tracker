import { fail, ok, verifyCronSecret } from "@/lib/api";
import type { StoreSlug } from "@/lib/constants";
import { db } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import { getScraperBySlug } from "@/lib/scrapers/registry";
import type { NextRequest } from "next/server";

// POST /api/scrape — trigger a scrape run for all active products
// Protected by SCRAPE_CRON_SECRET (Vercel cron or manual trigger).
export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) throw new AuthenticationError();

    const startedAt = new Date().toISOString();

    // Get active stores that have a scraper implementation
    const activeStores = await db.store.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    });

    const scrapableStores = activeStores.filter(
      (store) => getScraperBySlug(store.slug as StoreSlug) !== null,
    );

    let scraped = 0;
    let failed = 0;

    for (const store of scrapableStores) {
      const scraper = getScraperBySlug(store.slug as StoreSlug);
      if (!scraper) continue;

      // Get the most recent URL per product for this store
      const latestEntries = await db.priceEntry.findMany({
        where: {
          storeId: store.id,
          url: { not: null },
          product: { isActive: true },
        },
        select: { productId: true, url: true },
        distinct: ["productId"],
        orderBy: { scrapedAt: "desc" },
      });

      for (const entry of latestEntries) {
        if (!entry.url) continue;

        const result = await scraper.scrape(entry.url);
        if (!result) {
          failed++;
          continue;
        }

        await db.priceEntry.create({
          data: {
            productId: entry.productId,
            storeId: store.id,
            price: result.price,
            currency: result.currency,
            url: result.url,
            source: "SCRAPE",
            isAvailable: result.isAvailable,
          },
        });

        scraped++;
      }
    }

    return ok({
      message: "Scrape job completed",
      scraped,
      failed,
      stores: scrapableStores.length,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    return fail(error);
  }
}
