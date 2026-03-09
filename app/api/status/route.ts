import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import type { NextRequest } from "next/server";

// GET /api/status — returns the latest ScrapeRun per store
export async function GET(_request: NextRequest) {
  try {
    const stores = await db.store.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        websiteUrl: true,
        scrapeRuns: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            id: true,
            startedAt: true,
            finishedAt: true,
            status: true,
            productsScraped: true,
            errorMessage: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = stores.map((store) => {
      const latest = store.scrapeRuns[0] ?? null;
      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl,
        websiteUrl: store.websiteUrl,
        lastRun: latest
          ? {
              id: latest.id,
              startedAt: latest.startedAt.toISOString(),
              finishedAt: latest.finishedAt?.toISOString() ?? null,
              status: latest.status,
              productsScraped: latest.productsScraped,
              errorMessage: latest.errorMessage,
            }
          : null,
      };
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
