import { fail, ok, verifyCronSecret } from "@/lib/api";
import type { StoreSlug } from "@/lib/constants";
import { db } from "@/lib/db";
import { AuthenticationError } from "@/lib/errors";
import { getScraperBySlug } from "@/lib/scrapers/registry";
import type { PriceScraper } from "@/lib/scrapers/types";
import { ScrapeStatus } from "@prisma/client";
import type { NextRequest } from "next/server";

// Scrape a single store's product URLs and record the results.
// Returns { scraped, error } — never throws.
async function scrapeStore(
  storeId: string,
  scraper: PriceScraper,
): Promise<{ scraped: number; error: string | null }> {
  const latestEntries = await db.priceEntry.findMany({
    where: { storeId, url: { not: null }, product: { isActive: true } },
    select: { productId: true, url: true },
    distinct: ["productId"],
    orderBy: { scrapedAt: "desc" },
  });

  let scraped = 0;
  for (const entry of latestEntries) {
    if (!entry.url) continue;

    const result = await scraper.scrape(entry.url);
    if (!result) continue;

    await db.priceEntry.create({
      data: {
        productId: entry.productId,
        storeId,
        price: result.price,
        currency: result.currency,
        url: result.url,
        source: "SCRAPE",
        isAvailable: result.isAvailable,
      },
    });

    scraped++;
  }

  return { scraped, error: null };
}

// POST /api/scrape — trigger a scrape run for all active products
// Protected by SCRAPE_CRON_SECRET (Vercel cron or manual trigger).
export async function POST(request: NextRequest) {
  try {
    if (!verifyCronSecret(request)) throw new AuthenticationError();

    const startedAt = new Date().toISOString();

    const activeStores = await db.store.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    });

    const scrapableStores = activeStores.filter(
      (store) => getScraperBySlug(store.slug as StoreSlug) !== null,
    );

    let totalScraped = 0;
    let totalFailed = 0;

    for (const store of scrapableStores) {
      const scraper = getScraperBySlug(store.slug as StoreSlug);
      if (!scraper) continue;

      const scrapeRun = await db.scrapeRun.create({
        data: {
          storeId: store.id,
          startedAt: new Date(),
          status: ScrapeStatus.RUNNING,
          productsScraped: 0,
        },
      });

      let scraped = 0;
      let error: string | null = null;

      try {
        const { scraped: storeScraped, error: storeError } = await scrapeStore(
          store.id,
          scraper,
        );
        scraped = storeScraped;
        error = storeError;
        totalScraped += scraped;
      } catch (storeErr) {
        error = storeErr instanceof Error ? storeErr.message : "Unknown error";
        totalFailed++;
      }

      await db.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: {
          finishedAt: new Date(),
          status: error ? ScrapeStatus.FAILED : ScrapeStatus.SUCCESS,
          productsScraped: scraped,
          ...(error && { errorMessage: error }),
        },
      });
    }

    return ok({
      message: "Scrape job completed",
      scraped: totalScraped,
      failed: totalFailed,
      stores: scrapableStores.length,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    return fail(error);
  }
}
