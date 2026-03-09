import { created, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TrackFromSearchSchema } from "@/lib/schemas/product.schema";
import { slugify } from "@/lib/utils";
import type { NextRequest } from "next/server";

// POST /api/tracked/discover — create-or-find a product from a search result
// and add it to the authenticated user's tracked list.
//
// `siblings` carries every other store result from the same search query
// so that price entries for ALL stores are saved in one request. This means
// the PDP can immediately show a full ranked price comparison table.
//
// Slug strategy: slugify the product name to derive a stable identifier.
// Products already seeded in DB (e.g. dodot-sensitive-t5) are reused when
// the slugified name matches — no duplicate created.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = TrackFromSearchSchema.parse(await request.json());

    const slug = slugify(body.name);

    // Fetch all needed stores in one query
    const allStoreSlugs = [
      body.storeSlug,
      ...(body.siblings ?? []).map((s) => s.storeSlug),
    ];
    const stores = await db.store.findMany({
      where: { slug: { in: allStoreSlugs }, isActive: true },
      select: { id: true, slug: true },
    });
    const storeBySlug = new Map(stores.map((s) => [s.slug, s]));

    const primaryStore = storeBySlug.get(body.storeSlug);
    if (!primaryStore) {
      return fail(new Error(`Store "${body.storeSlug}" not found`));
    }

    // Find or create the product (idempotent by slug)
    const product = await db.product.upsert({
      where: { slug },
      create: {
        name: body.name,
        slug,
        imageUrl: body.imageUrl ?? null,
        ean: body.ean ?? null,
        category: null,
        isActive: true,
      },
      update: {},
      select: { id: true, slug: true },
    });

    // Build price entries for primary + all siblings and batch-insert them.
    // Using createMany so the PDP immediately has data from every store.
    const priceEntries = [
      {
        productId: product.id,
        storeId: primaryStore.id,
        price: body.price,
        currency: body.currency,
        url: body.productUrl ?? null,
        source: "SCRAPE" as const,
        isAvailable: true,
        packageSize: body.packageSize ?? null,
        netWeight: body.netWeight ?? null,
        netWeightUnit: body.netWeightUnit ?? null,
        subscribePrice: body.subscribePrice ?? null,
      },
      ...(body.siblings ?? []).flatMap((sibling) => {
        const sibStore = storeBySlug.get(sibling.storeSlug);
        if (!sibStore) return [];
        return [
          {
            productId: product.id,
            storeId: sibStore.id,
            price: sibling.price,
            currency: sibling.currency,
            url: sibling.productUrl ?? null,
            source: "SCRAPE" as const,
            isAvailable: true,
            packageSize: sibling.packageSize ?? null,
            netWeight: sibling.netWeight ?? null,
            netWeightUnit: sibling.netWeightUnit ?? null,
            subscribePrice: sibling.subscribePrice ?? null,
          },
        ];
      }),
    ];

    await db.priceEntry.createMany({ data: priceEntries });

    // Track the product for this user (idempotent)
    await db.trackedProduct.upsert({
      where: {
        userId_productId: { userId: session.user.id, productId: product.id },
      },
      create: { userId: session.user.id, productId: product.id },
      update: {},
    });

    return created({ productSlug: product.slug });
  } catch (error) {
    return fail(error);
  }
}
