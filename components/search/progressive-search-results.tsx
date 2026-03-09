"use client";

import { SearchResults } from "@/components/search/search-results";
import type { SearchResult } from "@/lib/scrapers/search/types";
import { useEffect, useState } from "react";

interface ProgressiveSearchResultsProps {
  readonly query: string;
  readonly isAuthenticated: boolean;
}

export function ProgressiveSearchResults({
  query,
  isAuthenticated,
}: ProgressiveSearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    const es = new EventSource(
      `/api/search/stream?q=${encodeURIComponent(query)}`,
    );

    function mergeAndSort(
      prev: SearchResult[],
      batch: SearchResult[],
    ): SearchResult[] {
      return [...prev, ...batch].sort((a, b) => a.price - b.price);
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
  }, [query]);

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
      <SearchResults
        results={results}
        query={query}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
