import { SkipLink } from "@/components/skip-link";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { StoreType } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Estado del Scraping — ${APP_NAME}`,
  description: "Estado en tiempo real de los scrapers de cada tienda.",
};

// Revalidate every 5 minutes so visitors get reasonably fresh data
export const revalidate = 300;

type ScrapingStatus = "SUCCESS" | "FAILED" | "RUNNING" | "NEVER";

function statusBadge(status: ScrapingStatus) {
  if (status === "SUCCESS") {
    return (
      <Badge variant="success" aria-label="Scraping correcto">
        🟢 OK
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge variant="danger" aria-label="Error en scraping">
        🔴 Error
      </Badge>
    );
  }
  if (status === "RUNNING") {
    return (
      <Badge variant="warning" aria-label="Scraping en curso">
        🟡 Activo
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" aria-label="Sin datos de scraping">
      ⚪ Sin datos
    </Badge>
  );
}

function categoryLabel(type: StoreType): string {
  if (type === StoreType.PHYSICAL) return "Supermercado / Tienda física";
  if (type === StoreType.ONLINE) return "Tienda online";
  return "Híbrido";
}

export default async function StatusPage() {
  const stores = await db.store.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      websiteUrl: true,
      type: true,
      logoUrl: true,
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
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const successCount = stores.filter(
    (s) => s.scrapeRuns[0]?.status === "SUCCESS",
  ).length;
  const failedCount = stores.filter(
    (s) => s.scrapeRuns[0]?.status === "FAILED",
  ).length;
  const neverCount = stores.filter((s) => s.scrapeRuns.length === 0).length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SkipLink />

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
              href={ROUTES.home}
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Productos
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="maincontent"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-6 py-10"
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Estado del Scraping
          </h1>
          <p className="mt-2 text-foreground/60">
            Última actualización de cada tienda. Se actualiza cada 5 minutos.
          </p>
        </div>

        {/* Summary stats */}
        <section aria-labelledby="summary-heading" className="mb-8">
          <h2 id="summary-heading" className="sr-only">
            Resumen
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-foreground/10 p-5 text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {successCount}
              </p>
              <p className="mt-1 text-sm text-foreground/60">Correctas</p>
            </div>
            <div className="rounded-xl border border-foreground/10 p-5 text-center">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {failedCount}
              </p>
              <p className="mt-1 text-sm text-foreground/60">Con errores</p>
            </div>
            <div className="rounded-xl border border-foreground/10 p-5 text-center">
              <p className="text-3xl font-bold text-foreground/40">
                {neverCount}
              </p>
              <p className="mt-1 text-sm text-foreground/60">Sin datos aún</p>
            </div>
          </div>
        </section>

        {/* Store table */}
        <section aria-labelledby="stores-table-heading">
          <h2 id="stores-table-heading" className="sr-only">
            Tabla de estado por tienda
          </h2>
          <div className="overflow-x-auto rounded-xl border border-foreground/10">
            <table className="w-full text-sm">
              <thead className="border-b border-foreground/10 bg-foreground/5">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Tienda
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Categoría
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Estado
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold"
                  >
                    Productos
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-3 text-left font-semibold sm:table-cell"
                  >
                    Último scraping
                  </th>
                  <th
                    scope="col"
                    className="hidden px-4 py-3 text-left font-semibold md:table-cell"
                  >
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/5">
                {stores.map((store) => {
                  const run = store.scrapeRuns[0] ?? null;
                  const scrapingStatus: ScrapingStatus = run
                    ? (run.status as ScrapingStatus)
                    : "NEVER";

                  return (
                    <tr
                      key={store.id}
                      className="transition-colors hover:bg-foreground/5"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={store.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          {store.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-foreground/60">
                        {categoryLabel(store.type)}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(scrapingStatus)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {run?.productsScraped ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-foreground/60 sm:table-cell">
                        {run?.finishedAt
                          ? new Date(run.finishedAt).toLocaleString("es-ES", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="hidden max-w-xs truncate px-4 py-3 text-red-600 dark:text-red-400 md:table-cell">
                        {run?.errorMessage ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10 px-6 py-4 text-center text-xs text-foreground/40">
        {APP_NAME} — datos actualizados automáticamente
      </footer>
    </div>
  );
}
