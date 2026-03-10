import { TrackProductButton } from "@/components/search/track-product-button";
import { STORE_COUNT } from "@/lib/constants";
import {
  type ComparisonMode,
  comparablePrice,
  formatComparablePrice,
  inferComparisonMode,
  quantityLabel,
} from "@/lib/price-comparison";
import type { SearchResult } from "@/lib/scrapers/search";
import { getImageSrc } from "@/lib/utils";
import Image from "next/image";

function modeUnitLabel(mode: ComparisonMode): string {
  if (mode === "per100g") return "kg";
  if (mode === "per100ml") return "l";
  return "ud";
}

interface CardPricesProps {
  readonly result: SearchResult;
  readonly mode: ComparisonMode;
  readonly unitPrice: number | null;
  readonly isBestUnitPrice: boolean;
  readonly showUnitPrice: boolean;
  readonly lowestUnitPrice: number | null;
  readonly allPrices: readonly number[];
}

function CardPrices({
  result,
  mode,
  unitPrice,
  isBestUnitPrice,
  showUnitPrice,
  lowestUnitPrice,
  allPrices,
}: CardPricesProps) {
  const qty = quantityLabel(result);

  return (
    <div className="mt-auto space-y-1">
      {/* Unit price — primary comparison value */}
      {showUnitPrice && unitPrice !== null ? (
        <div className="flex items-center justify-between">
          <div>
            <span
              className={`text-xl font-bold tabular-nums ${
                isBestUnitPrice
                  ? "text-green-600 dark:text-green-400"
                  : "text-foreground"
              }`}
            >
              {formatComparablePrice(unitPrice, mode)}
            </span>
            <span className="ml-1 text-xs text-foreground/50">
              / {modeUnitLabel(mode)}
            </span>
          </div>
          {isBestUnitPrice && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
              🏆 Mejor €/{modeUnitLabel(mode)}
            </span>
          )}
        </div>
      ) : (
        /* Fallback: no unit data — show raw price as before */
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold tabular-nums text-foreground">
            {result.price.toFixed(2)} {result.currency}
          </span>
          {lowestUnitPrice === null &&
            result.price === Math.min(...allPrices) && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                Mejor precio
              </span>
            )}
        </div>
      )}

      {/* Pack price + quantity — secondary reference info */}
      <div className="flex items-center gap-2 text-xs text-foreground/50">
        {showUnitPrice && (
          <span className="tabular-nums">
            {result.price.toFixed(2)} {result.currency} pack
          </span>
        )}
        {qty !== "—" && (
          <>
            {showUnitPrice && <span aria-hidden="true">·</span>}
            <span>{qty}</span>
          </>
        )}
        {result.subscribePrice != null &&
          result.subscribePrice < result.price && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-green-700 dark:text-green-400">
                {result.subscribePrice.toFixed(2)}€ recurrente
              </span>
            </>
          )}
      </div>
    </div>
  );
}

interface SearchResultsProps {
  readonly results: SearchResult[];
  readonly query: string;
  readonly isAuthenticated: boolean;
  readonly sortBy?: "unit" | "total";
}

export function SearchResults({
  results,
  query,
  isAuthenticated,
  sortBy = "unit",
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

  // Infer the unit comparison mode from the full result set so all cards use
  // the same normalisation (e.g. all show €/pañal rather than mixing €/ud and
  // raw price when some scrapers return packageSize and others don't).
  const mode = inferComparisonMode(results);
  const showUnitPrice = mode !== "rawPrice" && sortBy === "unit";

  // Find the best (lowest) unit price among results that have computable data.
  // Include shipping so items with hidden shipping costs rank correctly.
  const unitPrices = results
    .map((r) => comparablePrice(r, mode, true))
    .filter((v): v is number => v !== null);
  const lowestUnitPrice =
    unitPrices.length > 0 ? Math.min(...unitPrices) : null;

  const storesFound = new Set(results.map((r) => r.storeSlug)).size;

  function resolveSortLabel(): string {
    if (sortBy === "total") return "ordenados por precio total";
    if (showUnitPrice) return "ordenados por precio unitario";
    return "ordenados por precio";
  }
  const sortLabel = resolveSortLabel();

  return (
    <section aria-label="Resultados de búsqueda">
      <p className="mb-6 text-sm text-foreground/60">
        <strong>{results.length}</strong> resultado
        {results.length !== 1 ? "s" : ""} para{" "}
        <strong>&ldquo;{query}&rdquo;</strong> en <strong>{storesFound}</strong>{" "}
        de {STORE_COUNT} tiendas — {sortLabel}
      </p>
      <ul
        role="list"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {results.map((result, index) => {
          const unitPrice = comparablePrice(result, mode, true);
          const isBestUnitPrice =
            lowestUnitPrice !== null &&
            unitPrice !== null &&
            Math.abs(unitPrice - lowestUnitPrice) < 0.0001;

          return (
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

                    <CardPrices
                      result={result}
                      mode={mode}
                      unitPrice={unitPrice}
                      isBestUnitPrice={isBestUnitPrice}
                      showUnitPrice={showUnitPrice}
                      lowestUnitPrice={lowestUnitPrice}
                      allPrices={results.map((r) => r.price)}
                    />
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
          );
        })}
      </ul>
    </section>
  );
}
