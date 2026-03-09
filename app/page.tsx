import { auth } from "@/auth";
import { UntrackButton } from "@/components/dashboard/untrack-button";
import { SearchBar } from "@/components/search/search-bar";
import { SkipLink } from "@/components/skip-link";
import { APP_DESCRIPTION, APP_NAME, ROUTES, STORES } from "@/lib/constants";
import { db } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function Home() {
  const session = await auth();

  const trackedProducts = session?.user?.id
    ? await db.trackedProduct.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            include: {
              priceEntries: {
                where: { isAvailable: true },
                orderBy: { scrapedAt: "desc" },
                distinct: ["storeId"],
                include: { store: { select: { name: true } } },
              },
            },
          },
        },
      })
    : [];

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
            Busca el mejor precio
          </h1>
          <p className="mt-4 max-w-xl text-base text-foreground/60">
            {APP_DESCRIPTION}
          </p>
          <div className="mt-6 w-full max-w-xl">
            <SearchBar size="large" />
          </div>
        </section>

        {/* Tracked products — only for authenticated users */}
        {session && (
          <section
            aria-labelledby="tracked-heading"
            className="mx-auto max-w-5xl px-6 pb-16"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="tracked-heading" className="text-base font-semibold">
                Mis productos
              </h2>
              <Link
                href={ROUTES.search}
                className="text-sm text-foreground/60 hover:text-foreground"
              >
                Añadir producto →
              </Link>
            </div>
            {trackedProducts.length === 0 ? (
              <p className="text-sm text-foreground/50">
                Aún no sigues ningún producto.{" "}
                <Link href={ROUTES.search} className="underline">
                  Busca uno
                </Link>{" "}
                para empezar.
              </p>
            ) : (
              <ul
                role="list"
                className="divide-y divide-foreground/10 rounded-xl border border-foreground/10"
              >
                {trackedProducts.map(({ id, product }) => {
                  const entries = product.priceEntries;
                  const bestEntry = entries.reduce<
                    (typeof entries)[number] | null
                  >((best, entry) => {
                    if (!best) return entry;
                    const currentBestPrice = best.subscribePrice
                      ? Number(best.subscribePrice)
                      : Number(best.price);
                    const entryPrice = entry.subscribePrice
                      ? Number(entry.subscribePrice)
                      : Number(entry.price);
                    return entryPrice < currentBestPrice ? entry : best;
                  }, null);

                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between px-4 hover:bg-foreground/5"
                    >
                      <Link
                        href={ROUTES.productDetail(product.slug)}
                        className="flex min-w-0 flex-1 items-center justify-between py-4"
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {entries.length > 0 && (
                            <p className="text-sm text-foreground/50">
                              {entries.length}{" "}
                              {entries.length === 1 ? "tienda" : "tiendas"}
                            </p>
                          )}
                        </div>
                        {bestEntry && (
                          <div className="text-right">
                            <p className="font-semibold text-green-700 dark:text-green-400">
                              {Number(
                                bestEntry.subscribePrice ?? bestEntry.price,
                              ).toFixed(2)}{" "}
                              €
                            </p>
                            <p className="text-xs text-foreground/50">
                              {bestEntry.store.name}
                            </p>
                          </div>
                        )}
                      </Link>
                      <UntrackButton
                        productId={product.id}
                        productName={product.name}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

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
              Crea una cuenta gratuita para que te avisemos cuando un producto
              baje al precio que tú elijas.
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
