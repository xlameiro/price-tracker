"use client";

import { API_ROUTES, ROUTES } from "@/lib/constants";
import type { SearchResult } from "@/lib/scrapers/search";
import Link from "next/link";
import { useState } from "react";

interface TrackProductButtonProps {
  result: SearchResult;
  /** All results from the same search — saved as price entries for every store */
  allResults: readonly SearchResult[];
  /** Original search query — used as the canonical product name to avoid slug collisions */
  query: string;
}

function toTitleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
}

type TrackStatus = "idle" | "loading" | "tracked" | "error";

export function TrackProductButton({
  result,
  allResults,
  query,
}: Readonly<TrackProductButtonProps>) {
  const [status, setStatus] = useState<TrackStatus>("idle");
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAddToList() {
    setStatus("loading");
    setErrorMessage(null);

    // Siblings = all results except this one (different store, same search)
    const siblings = allResults
      .filter((r) => r !== result)
      .map((r) => ({
        storeSlug: r.storeSlug,
        price: r.price,
        currency: r.currency,
        productUrl: r.productUrl,
        packageSize: r.packageSize,
        netWeight: r.netWeight,
        netWeightUnit: r.netWeightUnit,
        subscribePrice: r.subscribePrice,
      }));

    try {
      // Use the original search query as the canonical name so all stores for the
      // same search produce a stable slug (e.g. "dodot-sensitive-talla-5") regardless
      // of how each retailer titles the product.
      const canonicalName = toTitleCase(query);

      const response = await fetch(API_ROUTES.trackDiscover, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: canonicalName,
          storeSlug: result.storeSlug,
          price: result.price,
          currency: result.currency,
          imageUrl: result.imageUrl ?? undefined,
          productUrl: result.productUrl,
          packageSize: result.packageSize,
          netWeight: result.netWeight,
          netWeightUnit: result.netWeightUnit,
          subscribePrice: result.subscribePrice,
          ean: result.ean,
          siblings,
        }),
      });

      if (response.status === 401) {
        setStatus("error");
        setErrorMessage("Inicia sesión para añadir productos.");
        return;
      }

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Error al añadir el producto.");
      }

      const data = (await response.json()) as { data: { productSlug: string } };
      setProductSlug(data.data.productSlug);
      setStatus("tracked");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Error inesperado.",
      );
    }
  }

  if (status === "tracked" && productSlug) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-green-700 dark:text-green-400">
          ✓ Añadido
        </span>
        <Link
          href={ROUTES.productDetail(productSlug)}
          className="rounded-md border border-foreground/20 px-3 py-1 text-xs font-medium hover:bg-foreground/5"
        >
          Ver comparativa →
        </Link>
      </div>
    );
  }

  if (status === "error") {
    return (
      <p role="alert" className="text-xs text-red-600 dark:text-red-400">
        {errorMessage}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleAddToList()}
      disabled={status === "loading"}
      aria-label={`Añadir ${result.productName} a mi lista`}
      className="w-full rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {status === "loading" ? "Añadiendo…" : "+ Añadir a mi lista"}
    </button>
  );
}
