"use client";

import { useDebounce } from "@/hooks/use-debounce";
import { ROUTES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface SearchBarProps {
  readonly initialQuery?: string;
  readonly size?: "default" | "large";
}

export function SearchBar({
  initialQuery = "",
  size = "default",
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLarge = size === "large";

  const debouncedSearch = useDebounce((value: unknown) => {
    const trimmed = String(value).trim();
    if (trimmed.length >= 3) {
      router.replace(`${ROUTES.search}?q=${encodeURIComponent(trimmed)}`);
    }
  }, 400);

  function submitSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`${ROUTES.search}?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitSearch();
      }}
      role="search"
      aria-label="Buscar producto"
    >
      <div
        className={`flex gap-2 ${isLarge ? "w-full max-w-2xl" : "w-full max-w-lg"}`}
      >
        <label htmlFor="search-input" className="sr-only">
          Buscar producto
        </label>
        <input
          id="search-input"
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            const { value } = event.target;
            setQuery(value);
            debouncedSearch(value);
          }}
          placeholder='p.ej. "Dodot Sensitive talla 5"'
          autoComplete="off"
          minLength={3}
          aria-required="true"
          className={`flex-1 rounded-lg border border-foreground/20 bg-background px-4 text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/30 ${isLarge ? "h-14 text-base" : "h-10 text-sm"}`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-lg bg-foreground font-semibold text-background hover:opacity-90 ${isLarge ? "h-14 px-8 text-base" : "h-10 px-6 text-sm"}`}
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
