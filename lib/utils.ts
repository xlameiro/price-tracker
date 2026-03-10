import { CATEGORY_UNIT_LABELS } from "@/lib/constants";
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes without conflicts.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date to a locale string.
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(date));
}

/**
 * Format a number as currency.
 */
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}…`;
}

/**
 * Delay execution for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Domains whose CDN is behind Cloudflare Bot Management.
// Server-side fetches (Node.js) are rejected regardless of headers because
// Cloudflare scores the TLS fingerprint as a bot. Browser fetches (real Chrome/
// Firefox JA3 fingerprint) are allowed, so we mark these as `unoptimized: true`
// to skip the /_next/image pipeline (which is server-side) and let the browser
// request the image directly. The img-src CSP in next.config.ts must list each
// hostname so the browser permits the cross-origin load.
const BROWSER_DIRECT_HOSTNAMES = new Set(["static.carrefour.es"]);

type ImageSrcResult = { src: string; unoptimized: boolean };

/**
 * Returns the src and unoptimized flag for a given image URL.
 *
 * - Cloudflare-protected CDNs → `unoptimized: true`: browser fetches directly.
 * - All other URLs → `unoptimized: false`: Next.js optimization pipeline runs.
 */
export function getImageSrc(imageUrl: string): ImageSrcResult {
  try {
    const { hostname } = new URL(imageUrl);
    if (BROWSER_DIRECT_HOSTNAMES.has(hostname)) {
      return { src: imageUrl, unoptimized: true };
    }
  } catch {
    // Invalid URL — pass through unchanged.
  }
  return { src: imageUrl, unoptimized: false };
}

/**
 * Convert a free-text product name into a URL-safe slug.
 * Strips accents, lowercases, and replaces non-alphanumeric chars with hyphens.
 * e.g. "Pañales Dodot Sensitive Talla 5" → "panales-dodot-sensitive-talla-5"
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .split("-")
    .filter((segment) => segment.length > 0) // trim leading/trailing hyphens
    .join("-")
    .slice(0, 200);
}

/**
 * Returns the singular unit label for per-unit price display.
 *
 * Resolution order:
 * 1. Category name → `CATEGORY_UNIT_LABELS` lookup (most specific)
 * 2. netWeightUnit hint → infer from scraped weight data
 * 3. Fallback → "ud."
 *
 * The netWeightUnit hint is useful in search results where we have scraped
 * data but may not know the product category.
 */
export function getUnitLabel(
  category: string | null | undefined,
  netWeightUnit?: "g" | "ml" | null,
): string {
  if (category) {
    const mapped = CATEGORY_UNIT_LABELS[category.toLowerCase()];
    if (mapped) return mapped;
  }
  if (netWeightUnit === "g") return "kg";
  if (netWeightUnit === "ml") return "l";
  return "ud.";
}
