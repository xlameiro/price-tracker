import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmazonSearchScraper } from "./amazon-search";
import { browserClient } from "./scraper-utils";

const ASIN = "B07XYZABCD";
const PRODUCT_URL = `https://www.amazon.es/dp/${ASIN}`;

const CTX = { query: "dodot talla 5", eans: [] as string[] };

// ── HTML builders ─────────────────────────────────────────────────────────────

/** One SERP card (no price — price comes from the PDP now). */
function makeSerpItem(
  itemName: string,
  href: string,
  imgSrc = "https://m.media-amazon.com/test.jpg",
): string {
  return `
    <div data-component-type="s-search-result">
      <a href="${href}">
        <h2>${itemName}</h2>
      </a>
      <img class="s-image" src="${imgSrc}" />
    </div>
  `;
}

/** A minimal Amazon PDP with .priceToPay containing the checkout price. */
function makePdp(whole: string, fraction: string, available = true): string {
  return `
    <html><body>
      <span class="priceToPay">
        <span class="a-offscreen">${whole},${fraction} €</span>
      </span>
      ${available ? '<input id="add-to-cart-button">' : ""}
    </body></html>
  `;
}

/** A PDP that also shows a Subscribe & Save price in the sns-price widget. */
function makePdpWithSns(
  regularWhole: string,
  regularFraction: string,
  snsWhole: string,
  snsFraction: string,
): string {
  return `
    <html><body>
      <span class="priceToPay">
        <span class="a-offscreen">${regularWhole},${regularFraction} €</span>
      </span>
      <div id="sns-price">
        <span class="a-price">
          <span class="a-offscreen">${snsWhole},${snsFraction} €</span>
        </span>
      </div>
      <input id="add-to-cart-button">
    </body></html>
  `;
}

/** A SERP response wrapping one or more item HTML strings. */
function makeSerpHtml(...items: string[]): string {
  return `<html><body>${items.join("")}</body></html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Mock: SERP returns `serpHtml`, each PDP call returns `pdpHtml`. */
function mockSerpAndPdp(
  fetchSpy: ReturnType<typeof vi.spyOn>,
  serpHtml: string,
  pdpHtml: string | null,
) {
  fetchSpy
    .mockResolvedValueOnce({ ok: true, text: async () => serpHtml } as Response) // SERP
    .mockResolvedValue(
      pdpHtml !== null
        ? ({ ok: true, text: async () => pdpHtml } as Response)
        : ({ ok: false } as Response),
    );
}

describe("AmazonSearchScraper", () => {
  let scraper: AmazonSearchScraper;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scraper = new AmazonSearchScraper();
    fetchSpy = vi.spyOn(browserClient, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have storeSlug amazon-es", () => {
    expect(scraper.storeSlug).toBe("amazon-es");
  });

  it("should return empty array when SERP fetch throws", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));
    expect(await scraper.search(CTX)).toEqual([]);
  });

  it("should return empty array when SERP response is not ok", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    expect(await scraper.search(CTX)).toEqual([]);
  });

  it("should return empty array when there are no SERP result items", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => "<html><body><p>No results</p></body></html>",
    } as Response);
    expect(await scraper.search(CTX)).toEqual([]);
  });

  it("should set subscribePrice from the SNS widget on the PDP", async () => {
    // PDP shows regular price 92.49 in .priceToPay and 78.62 in #sns-price.
    mockSerpAndPdp(
      fetchSpy,
      makeSerpHtml(makeSerpItem("Dodot Talla 5 168 pañales", `/dp/${ASIN}`)),
      makePdpWithSns("92", "49", "78", "62"),
    );
    const results = await scraper.search(CTX);
    expect(results[0]?.price).toBe(92.49);
    expect(results[0]?.subscribePrice).toBe(78.62);
  });

  it("should not set subscribePrice when no SNS widget is present", async () => {
    mockSerpAndPdp(
      fetchSpy,
      makeSerpHtml(makeSerpItem("Dodot Talla 5 42 pañales", `/dp/${ASIN}`)),
      makePdp("22", "95"),
    );
    const results = await scraper.search(CTX);
    expect(results[0]?.price).toBe(22.95);
    expect(results[0]?.subscribePrice).toBeUndefined();
  });

  it("should parse price from PDP, not SERP", async () => {
    // The SERP card has NO price — price comes from the PDP.
    mockSerpAndPdp(
      fetchSpy,
      makeSerpHtml(
        makeSerpItem("Dodot Talla 5 42 pañales", `/dp/${ASIN}/ref=sr_1_1`),
      ),
      makePdp("78", "62"),
    );
    const results = await scraper.search(CTX);
    expect(results).toHaveLength(1);
    expect(results[0]?.price).toBe(78.62);
    expect(results[0]?.currency).toBe("EUR");
  });

  it("should build a canonical product URL from ASIN, stripping tracking params", async () => {
    const href = `/dp/${ASIN}/ref=sr_1_1?keywords=dodot&qid=1234`;
    mockSerpAndPdp(
      fetchSpy,
      makeSerpHtml(makeSerpItem("Dodot Talla 5 42 pañales", href)),
      makePdp("22", "95"),
    );
    const results = await scraper.search(CTX);
    expect(results[0]?.productUrl).toBe(PRODUCT_URL);
  });

  it("should fetch the Subscribe-and-Save price from the PDP", async () => {
    // PDP shows the S&S price (78.62) — not the regular SERP price (92.49).
    mockSerpAndPdp(
      fetchSpy,
      makeSerpHtml(makeSerpItem("Dodot Talla 5 168 pañales", `/dp/${ASIN}`)),
      makePdp("78", "62"),
    );
    const results = await scraper.search(CTX);
    expect(results[0]?.price).toBe(78.62);
  });

  it("should extract packageSize from product name", async () => {
    mockSerpAndPdp(
      fetchSpy,
      makeSerpHtml(
        makeSerpItem("Dodot Sensitive Talla 5, 168 pañales", `/dp/${ASIN}`),
      ),
      makePdp("78", "62"),
    );
    const results = await scraper.search(CTX);
    expect(results[0]?.packageSize).toBe(168);
  });

  it("should set isAvailable=true when add-to-cart button is present on PDP", async () => {
    mockSerpAndPdp(
      fetchSpy,
      makeSerpHtml(makeSerpItem("Dodot Talla 5 42 pañales", `/dp/${ASIN}`)),
      makePdp("22", "95", true),
    );
    const results = await scraper.search(CTX);
    expect(results[0]?.isAvailable).toBe(true);
  });

  it("should skip results whose PDP returns not-ok", async () => {
    // SERP has one item but PDP returns 404 — result should be dropped.
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          makeSerpHtml(makeSerpItem("Dodot Talla 5 42 pañales", `/dp/${ASIN}`)),
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response); // PDP 404
    expect(await scraper.search(CTX)).toEqual([]);
  });

  it("should return at most 5 results", async () => {
    // 8 SERP items → only first 5 collected → 5 PDP calls → 5 results
    const item = makeSerpItem("Dodot 42 pañales", `/dp/${ASIN}`);
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        text: async () => makeSerpHtml(...Array(8).fill(item)),
      } as Response)
      .mockResolvedValue({
        ok: true,
        text: async () => makePdp("22", "95"),
      } as Response);
    const results = await scraper.search(CTX);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("should skip SERP items without a product name", async () => {
    const itemNoName = `
      <div data-component-type="s-search-result">
        <a href="/dp/${ASIN}"><h2></h2></a>
      </div>`;
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => `<html><body>${itemNoName}</body></html>`,
    } as Response);
    expect(await scraper.search(CTX)).toEqual([]);
  });
});
