/**
 * Shared utilities for search scrapers.
 */

import { Impit } from "impit";

/**
 * Shared impit instance with Chrome TLS fingerprint + browser header emulation.
 * `browser: "chrome"` makes impit auto-generate realistic Chrome headers
 * (sec-ch-ua, Sec-Fetch-*, Accept, etc.) and use BoringSSL cipher suites
 * — the main signal used by Cloudflare and other WAFs to detect Node.js scrapers.
 */
export const browserClient = new Impit({
  browser: "chrome",
  timeout: 10_000,
  // Override Accept-Language to Spanish so store results are localised
  headers: { "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" },
});

/**
 * Extract the number of units in a pack from a product name.
 * e.g. "Pañales Dodot 44 unidades" → 44, "Dodot T5 42 uds" → 42
 * Input is internal scraped data (not user-controlled).
 */
export function extractPackageSize(name: string): number | undefined {
  const lower = name.toLowerCase();
  const tokens = lower.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? "";
    if (!/^\d+$/.test(token)) continue;
    // Strip trailing punctuation (e.g. "und." → "und", "uds," → "uds")
    const next = (tokens[i + 1] ?? "").replace(/[^a-záéíóúüñ]/g, "");
    if (
      next === "pañales" ||
      next === "panales" ||
      next.startsWith("ud") || // uds, ud, udn
      next.startsWith("und") || // und (used by some Spanish stores)
      next === "unidades" ||
      next === "unidad"
    ) {
      return Number.parseInt(token, 10);
    }
  }
  return undefined;
}

/**
 * Parse a Spanish price string (e.g. "12,99 €") to a float.
 * Returns NaN if parsing fails.
 */
export function parseSpanishPrice(raw: string): number {
  return Number.parseFloat(raw.replace(/[^\d,]/g, "").replace(",", "."));
}

/** Parse the refresh URL from an Akamai bot-challenge meta-refresh page. */
function parseMetaRefreshUrl(html: string, baseOrigin: string): string | null {
  // Akamai sends: <meta http-equiv="refresh" content="5; URL='/path?bm-verify=...'" />
  const match = /content="\d+;\s*URL='([^']+)'"/i.exec(html);
  if (!match) return null;
  const raw = match[1].replace(/&amp;/g, "&");
  return raw.startsWith("http") ? raw : `${baseOrigin}${raw}`;
}

/**
 * Fetch HTML using Chrome TLS + header fingerprint emulation via impit.
 * Automatically follows a single Akamai bot-challenge meta-refresh redirect
 * (identified by a short response containing a bm-verify token in the URL).
 * Returns null on any error (network, non-2xx, etc.).
 */
export async function fetchHtml(
  url: string,
  timeoutMs = 10_000,
): Promise<string | null> {
  try {
    const response = await browserClient.fetch(url, { timeout: timeoutMs });
    if (!response.ok) return null;
    const html = await response.text();

    // Short placeholder pages (~2-3 KB) with a meta-refresh are Akamai challenges.
    // Follow the redirect once with the bm-verify token to get the real page.
    if (html.length < 10_000 && html.includes("bm-verify")) {
      const { origin } = new URL(url);
      const redirectUrl = parseMetaRefreshUrl(html, origin);
      if (redirectUrl) {
        await new Promise<void>((r) => setTimeout(r, 500));
        const resp2 = await browserClient.fetch(redirectUrl, {
          timeout: timeoutMs,
        });
        return resp2.ok ? resp2.text() : null;
      }
    }

    return html;
  } catch {
    return null;
  }
}
