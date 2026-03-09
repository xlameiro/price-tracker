import { auth } from "@/auth";
import { ProductCatalogCard } from "@/components/products/product-catalog-card";
import { SkipLink } from "@/components/skip-link";
import {
  APP_DESCRIPTION,
  APP_NAME,
  DODOT_PRODUCTS,
  ROUTES,
  STORES,
} from "@/lib/constants";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function Home() {
  const session = await auth();

  // Fetch latest price entries per store per product so we can compute
  // the lowest unit price to display on each card
  const products = await db.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      priceEntries: {
        where: { isAvailable: true },
        orderBy: { scrapedAt: "desc" },
        distinct: ["storeId"],
        select: {
          price: true,
          packageSize: true,
        },
      },
    },
  });

  // Build a lookup: slug → { lowestUnitPrice, storeCount }
  const productStats = new Map<
    string,
    { lowestUnitPrice: number | null; storeCount: number }
  >();
  for (const product of products) {
    const unitPrices = product.priceEntries
      .filter((e) => e.packageSize !== null && e.packageSize > 0)
      .map((e) => Number(e.price) / e.packageSize!);

    productStats.set(product.slug, {
      lowestUnitPrice: unitPrices.length > 0 ? Math.min(...unitPrices) : null,
      storeCount: product.priceEntries.length,
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SkipLink />

      <header className="border-b border-foreground/10 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
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
            {session ? (
              <Link
                href={ROUTES.dashboard}
                className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90"
              >
                Mi panel
              </Link>
            ) : (
              <>
                <Link
                  href={ROUTES.signIn}
                  className="text-sm text-foreground/70 hover:text-foreground"
                >
                  Entrar
                </Link>
                <Link
                  href={ROUTES.signUp}
                  className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90"
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="maincontent" tabIndex={-1} className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-14 text-center">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Compara precios de pañales
          </h1>
          <p className="mt-4 max-w-xl text-base text-foreground/60">
            {APP_DESCRIPTION}
          </p>
        </section>

        {/* Product catalog */}
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="flex flex-col items-center gap-4">
            {DODOT_PRODUCTS.map((product) => {
              const stats = productStats.get(product.slug);
              return (
                <div key={product.slug} className="w-full max-w-sm">
                  <ProductCatalogCard
                    slug={product.slug}
                    name={product.name}
                    size={product.size}
                    kgRange={product.kgRange}
                    lowestUnitPrice={stats?.lowestUnitPrice ?? null}
                    storeCount={stats?.storeCount ?? 0}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Stores section */}
        <section
          aria-labelledby="stores-heading"
          className="border-y border-foreground/10 bg-foreground/5 px-6 py-12"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="stores-heading"
              className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-foreground/50"
            >
              {STORES.length} tiendas comparadas
            </h2>
            <ul role="list" className="flex flex-wrap justify-center gap-3">
              {STORES.map((store) => (
                <li
                  key={store.slug}
                  className="flex h-9 items-center justify-center rounded-lg border border-foreground/10 bg-background px-4 text-xs font-medium"
                >
                  {store.name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA for unauthenticated users */}
        {!session && (
          <section className="mx-auto max-w-5xl px-6 py-16 text-center">
            <h2 className="mb-4 text-2xl font-bold tracking-tight">
              Recibe alertas de bajada de precio
            </h2>
            <p className="mb-8 text-base text-foreground/60">
              Crea una cuenta gratuita para que te avisemos cuando un pañal baje
              al precio que tú elijas.
            </p>
            <Link
              href={ROUTES.signUp}
              className="inline-block rounded-md bg-foreground px-6 py-3 text-sm font-semibold text-background hover:opacity-90"
            >
              Crear cuenta gratis
            </Link>
          </section>
        )}
      </main>

      <footer className="border-t border-foreground/10 px-6 py-4 text-center text-xs text-foreground/40">
        {APP_NAME} ·{" "}
        <Link href={ROUTES.status} className="hover:text-foreground/70">
          Estado del scraping
        </Link>
      </footer>
    </div>
  );
}
