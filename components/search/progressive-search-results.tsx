"use client";

import { SearchResults } from "@/components/search/search-results";
import {
  compareByUnitPrice,
  effectivePrice,
  inferComparisonMode,
} from "@/lib/price-comparison";
import type { SearchResult } from "@/lib/scrapers/search/types";
import { useSearchPreferencesStore } from "@/store/use-search-preferences-store";
import { useEffect, useState } from "react";

interface ProgressiveSearchResultsProps {
  readonly query: string;
  readonly isAuthenticated: boolean;
}

function SortToggle() {
  const { sortBy, setSortBy } = useSearchPreferencesStore();

  return (
    <div
      role="group"
      aria-label="Criterio de ordenación"
      className="mb-4 flex items-center gap-2 text-sm"
    >
      <span className="text-foreground/50">Ordenar por:</span>
      <div className="flex rounded-lg border border-foreground/15 bg-foreground/5 p-0.5">
        <button
          type="button"
          onClick={() => setSortBy("unit")}
          aria-pressed={sortBy === "unit"}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            sortBy === "unit"
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground/50 hover:text-foreground"
          }`}
        >
          Precio / unidad
        </button>
        <button
          type="button"
          onClick={() => setSortBy("total")}
          aria-pressed={sortBy === "total"}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            sortBy === "total"
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground/50 hover:text-foreground"
          }`}
        >
          Precio total pack
        </button>
      </div>
    </div>
  );
}

export function ProgressiveSearchResults({
  query,
  isAuthenticated,
}: ProgressiveSearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isDone, setIsDone] = useState(false);
  const sortBy = useSearchPreferencesStore((state) => state.sortBy);

  useEffect(() => {
    const es = new EventSource(
      `/api/search/stream?q=${encodeURIComponent(query)}`,
    );

    function mergeAndSort(
      prev: SearchResult[],
      batch: SearchResult[],
    ): SearchResult[] {
      const all = [...prev, ...batch];
      const mode = inferComparisonMode(all);
      if (sortBy === "total") {
        return all.sort(
          (a, b) => effectivePrice(a, true) - effectivePrice(b, true),
        );
      }
      return all.sort((a, b) => compareByUnitPrice(a, b, mode, true));
    }

    es.addEventListener("results", (event) => {
      const batch = JSON.parse(
        (event as MessageEvent<string>).data,
      ) as SearchResult[];
      setResults((prev) => mergeAndSort(prev, batch));
    });

    es.addEventListener("done", () => {
      setIsDone(true);
      es.close();
    });

    es.onerror = () => {
      setIsDone(true);
      es.close();
    };

    return () => {
      es.close();
      setResults([]);
      setIsDone(false);
    };
  }, [query, sortBy]);

  // Show skeleton while EAN resolution + first scrapers are running
  if (results.length === 0 && !isDone) {
    return (
      <div
        role="status"
        aria-label="Buscando productos"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-foreground/10 bg-foreground/5"
          />
        ))}
        <span className="sr-only">Buscando en todas las tiendas…</span>
      </div>
    );
  }

  return (
    <div>
      {!isDone && results.length > 0 && (
        <p
          aria-live="polite"
          className="mb-4 animate-pulse text-xs text-foreground/50"
        >
          Consultando más tiendas…
        </p>
      )}
      <SortToggle />
      <SearchResults
        results={results}
        query={query}
        isAuthenticated={isAuthenticated}
        sortBy={sortBy}
      />
    </div>
  );
}
