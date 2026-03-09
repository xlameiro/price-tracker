import type { PriceRow } from "@/components/products/price-ranking-table";
import {
  comparablePrice,
  inferComparisonMode,
  PriceRankingTable,
} from "@/components/products/price-ranking-table";
import { RefreshPricesButton } from "@/components/products/refresh-prices-button";
import { SkipLink } from "@/components/skip-link";
import { APP_NAME, DODOT_PRODUCTS, ROUTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { getUnitLabel } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findFirst({
    where: { slug, isActive: true },
    select: { name: true },
  });

  if (!product) return { title: "Producto no encontrado" };

  return {
    title: `${product.name} — Comparador de precios | ${APP_NAME}`,
    description: `Compara el precio de ${product.name} en los principales supermercados y tiendas de España. Precio por unidad, gastos de envío incluidos.`,
  };
}

export default async function ProductPage({
  params,
}: Readonly<ProductPageProps>) {
  const { slug } = await params;

  const product = await db.product.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      category: true,
      brand: true,
    },
  });

  if (!product) notFound();

  // Get the latest PriceEntry per store (distinct on storeId, ordered by scrapedAt desc)
  const latestPrices = await db.priceEntry.findMany({
    where: { productId: product.id, isAvailable: true },
    orderBy: { scrapedAt: "desc" },
    distinct: ["storeId"],
    select: {
      id: true,
      price: true,
      subscribePrice: true,
      packageSize: true,
      netWeight: true,
      netWeightUnit: true,
      shippingCost: true,
      url: true,
      scrapedAt: true,
      store: {
        select: {
          id: true,
          name: true,
          websiteUrl: true,
          freeShippingThreshold: true,
          shippingNote: true,
        },
      },
    },
  });

  const rows: PriceRow[] = latestPrices.map((entry) => ({
    storeId: entry.store.id,
    storeName: entry.store.name,
    storeUrl: entry.store.websiteUrl,
    freeShippingThreshold: entry.store.freeShippingThreshold
      ? Number(entry.store.freeShippingThreshold)
      : null,
    shippingNote: entry.store.shippingNote,
    price: Number(entry.price),
    subscribePrice: entry.subscribePrice ? Number(entry.subscribePrice) : null,
    packageSize: entry.packageSize,
    netWeight: entry.netWeight ? Number(entry.netWeight) : null,
    netWeightUnit: (entry.netWeightUnit as "g" | "ml" | null) ?? null,
    shippingCost: entry.shippingCost ? Number(entry.shippingCost) : null,
    productUrl: entry.url,
    scrapedAt: entry.scrapedAt,
  }));

  // Extra metadata from DODOT_PRODUCTS constant (size, kg range)
  const dodotMeta = DODOT_PRODUCTS.find((p) => p.slug === product.slug);
  const unitLabel = getUnitLabel(product.category);

  // Lowest comparable price for the summary hero line, using the same
  // comparison mode as the ranking table.
  const compMode = inferComparisonMode(rows);
  const lowestUnitPrice =
    rows
      .map((r) => comparablePrice(r, compMode))
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b)[0] ?? null;

  const HERO_SUFFIX: Record<typeof compMode, string> = {
    per100g: "por 100g",
    per100ml: "por 100ml",
    perUnit: `por ${unitLabel}`,
    rawPrice: "",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SkipLink />

      {/* Header */}
      <header className="border-b border-foreground/10 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href={ROUTES.home}
            className="font-semibold tracking-tight hover:opacity-80"
          >
            {APP_NAME}
          </Link>
          <nav
            aria-label="Navegación del sitio"
            className="flex items-center gap-4"
          >
            <Link
              href={ROUTES.status}
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Estado scraping
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="maincontent"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-6 py-10"
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 text-sm text-foreground/50"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link href={ROUTES.home} className="hover:text-foreground">
                Productos
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground" aria-current="page">
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Product heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {product.name}
          </h1>
          {dodotMeta && (
            <p className="mt-2 text-foreground/60">
              Talla {dodotMeta.size} · {dodotMeta.kgRange}
            </p>
          )}
          {lowestUnitPrice != null && (
            <p className="mt-3 text-lg">
              Desde{" "}
              <span className="font-bold text-green-700 dark:text-green-400">
                {new Intl.NumberFormat("es-ES", {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: compMode === "rawPrice" ? 2 : 3,
                  maximumFractionDigits: compMode === "rawPrice" ? 2 : 3,
                }).format(lowestUnitPrice)}
              </span>
              {HERO_SUFFIX[compMode] ? ` ${HERO_SUFFIX[compMode]}` : ""}
            </p>
          )}
        </div>

        {/* Price ranking table */}
        <section aria-labelledby="ranking-heading">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="ranking-heading" className="text-xl font-semibold">
              Comparativa de precios ({rows.length}{" "}
              {rows.length === 1 ? "tienda" : "tiendas"})
            </h2>
            <RefreshPricesButton slug={product.slug} />
          </div>
          <PriceRankingTable rows={rows} />
        </section>

        {/* Help text */}
        {rows.length === 0 && (
          <p className="mt-6 text-sm text-foreground/50">
            Los precios se actualizan automáticamente cada día. Si no ves datos,
            el scraping aún no ha encontrado este producto en las tiendas.
          </p>
        )}
      </main>

      <footer className="border-t border-foreground/10 px-6 py-4 text-center text-xs text-foreground/40">
        {APP_NAME} — precios actualizados automáticamente ·{" "}
        <Link href={ROUTES.status} className="hover:text-foreground/70">
          Estado del scraping
        </Link>
      </footer>
    </div>
  );
}
