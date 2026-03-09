import { fail, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { searchAllStores } from "@/lib/scrapers/search";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/products/[id]/refresh
// Force-rediscovers prices for a single product: deletes stale SCRAPE entries,
// runs all search scrapers in parallel, and writes fresh price data.
// [id] accepts either a CUID or a slug (same as the GET handler above).
// Requires an authenticated session — the secret never reaches the browser.
export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    await requireAuth();

    const { id } = await params;

    const product = await db.product.findFirst({
      where: { OR: [{ id }, { slug: id }], isActive: true },
      select: { id: true, name: true, slug: true },
    });

    if (!product) throw new NotFoundError("Product not found");

    const stores = await db.store.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    });
    const storeBySlug = new Map(stores.map((s) => [s.slug, s]));

    // Delete stale SCRAPE entries before refreshing to avoid duplicates
    const { count: deleted } = await db.priceEntry.deleteMany({
      where: { productId: product.id, source: "SCRAPE" },
    });

    const results = await searchAllStores(product.name);

    // When a scraper returns multiple results for the same store (e.g. Amazon
    // SERP returns 5 products), keep only the one with the best unit price so
    // we save exactly one price entry per store.
    const bestByStore = new Map<string, (typeof results)[number]>();
    for (const result of results) {
      const existing = bestByStore.get(result.storeSlug);
      if (!existing) {
        bestByStore.set(result.storeSlug, result);
        continue;
      }
      const existingUnit =
        (existing.subscribePrice ?? existing.price) /
        (existing.packageSize ?? 1);
      const newUnit =
        (result.subscribePrice ?? result.price) / (result.packageSize ?? 1);
      if (newUnit < existingUnit) bestByStore.set(result.storeSlug, result);
    }

    const matches = [...bestByStore.values()].flatMap((result) => {
      const store = storeBySlug.get(result.storeSlug);
      if (!store) return [];
      return [
        {
          productId: product.id,
          storeId: store.id,
          price: result.price,
          subscribePrice: result.subscribePrice ?? null,
          currency: result.currency,
          url: result.productUrl ?? null,
          source: "SCRAPE" as const,
          isAvailable: result.isAvailable,
          packageSize: result.packageSize ?? null,
          storeName: result.storeName,
        },
      ];
    });

    await db.priceEntry.createMany({
      data: matches.map(({ storeName: _, ...entry }) => entry),
    });

    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/");

    return ok({
      message: "Refresh completed",
      slug: product.slug,
      deleted,
      discovered: matches.length,
      stores: matches.map((m) => m.storeName),
    });
  } catch (error) {
    return fail(error);
  }
}
