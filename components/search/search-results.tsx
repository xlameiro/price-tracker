import { TrackProductButton } from "@/components/search/track-product-button";
import { STORE_COUNT } from "@/lib/constants";
import type { SearchResult } from "@/lib/scrapers/search";
import { getImageSrc } from "@/lib/utils";
import Image from "next/image";

interface SearchResultsProps {
  readonly results: SearchResult[];
  readonly query: string;
  readonly isAuthenticated: boolean;
}

export function SearchResults({
  results,
  query,
  isAuthenticated,
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-8 py-12 text-center">
        <p className="text-base font-semibold text-foreground">
          No encontramos &ldquo;{query}&rdquo; en ninguna tienda
        </p>
        <p className="mt-2 text-sm text-foreground/60">
          Consultamos {STORE_COUNT} tiendas. Prueba con menos palabras o una
          búsqueda más genérica, por ejemplo: <em>Dodot talla 5</em>.
        </p>
      </div>
    );
  }

  const cheapestPrice = results[0]?.price;
  const storesFound = new Set(results.map((r) => r.storeSlug)).size;

  return (
    <section aria-label="Resultados de búsqueda">
      <p className="mb-6 text-sm text-foreground/60">
        <strong>{results.length}</strong> resultado
        {results.length !== 1 ? "s" : ""} para{" "}
        <strong>&ldquo;{query}&rdquo;</strong> en <strong>{storesFound}</strong>{" "}
        de {STORE_COUNT} tiendas — ordenados por precio
      </p>
      <ul
        role="list"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {results.map((result, index) => (
          <li key={`${result.storeSlug}-${String(index)}`}>
            <div className="flex h-full flex-col rounded-xl border border-foreground/10 bg-background transition-all hover:border-foreground/30 hover:shadow-sm">
              <a
                href={result.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-1 flex-col p-4"
                aria-label={`${result.productName} en ${result.storeName} por ${result.price.toFixed(2)}€`}
              >
                {result.imageUrl && (
                  <div className="relative mb-3 h-32 overflow-hidden rounded-lg bg-foreground/5">
                    <Image
                      {...getImageSrc(result.imageUrl)}
                      alt={result.productName}
                      fill
                      className="object-contain p-2"
                      sizes="(max-width: 640px) 33vw, 120px"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                    {result.storeName}
                  </span>
                  <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug text-foreground">
                    {result.productName}
                  </p>
                  <div className="mt-auto flex items-center justify-between">
                    <span
                      className={`text-xl font-bold ${result.price === cheapestPrice ? "text-green-600" : "text-foreground"}`}
                    >
                      {result.price.toFixed(2)} {result.currency}
                    </span>
                    {result.price === cheapestPrice && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        Mejor precio
                      </span>
                    )}
                  </div>
                </div>
              </a>
              {isAuthenticated && (
                <div className="border-t border-foreground/10 px-4 py-3">
                  <TrackProductButton
                    result={result}
                    allResults={results}
                    query={query}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
