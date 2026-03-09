import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmazonScraper } from "./amazon";
import { browserClient } from "./search/scraper-utils";

describe("AmazonScraper", () => {
  let scraper: AmazonScraper;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scraper = new AmazonScraper();
    fetchSpy = vi.spyOn(browserClient, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have storeSlug amazon-es", () => {
    expect(scraper.storeSlug).toBe("amazon-es");
  });

  it("should return null when fetch throws a network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));
    const result = await scraper.scrape("https://amazon.es/dp/B001");
    expect(result).toBeNull();
  });

  it("should return null when response is not ok", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    const result = await scraper.scrape("https://amazon.es/dp/B001");
    expect(result).toBeNull();
  });

  it("should return null when html has no price elements", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => "<html><body><p>No price here</p></body></html>",
    } as Response);
    const result = await scraper.scrape("https://amazon.es/dp/B001");
    expect(result).toBeNull();
  });

  it("should parse price from valid Amazon HTML", async () => {
    const html = `
      <html><body>
        <span class="a-price">
          <span class="a-price-whole">29,</span>
          <span class="a-price-fraction">99</span>
        </span>
        <input id="add-to-cart-button" />
      </body></html>
    `;
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    } as Response);
    const result = await scraper.scrape("https://amazon.es/dp/B001");
    expect(result).not.toBeNull();
    expect(result?.currency).toBe("EUR");
    expect(result?.url).toBe("https://amazon.es/dp/B001");
    expect(result?.isAvailable).toBe(true);
    expect(result?.price).toBeGreaterThan(0);
  });

  it("should return the sale price, not the struck-through list price", async () => {
    // Amazon renders the list price in .a-text-price (struck through) BEFORE
    // the sale price in DOM order. We must skip it and return the sale price.
    const html = `
      <html><body>
        <span class="a-price a-text-price" data-a-strike="true">
          <span class="a-price-whole">92,</span>
          <span class="a-price-fraction">49</span>
        </span>
        <span class="a-price">
          <span class="a-price-whole">78,</span>
          <span class="a-price-fraction">62</span>
        </span>
        <input id="add-to-cart-button" />
      </body></html>
    `;
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    } as Response);
    const result = await scraper.scrape("https://amazon.es/dp/B001");
    expect(result?.price).toBe(78.62);
  });

  it("should use priceToPay class to get the actual sale price", async () => {
    // Real Amazon buyboxes use .priceToPay for the checkout price and
    // .a-text-price for the struck-through "Precio único". This test mirrors
    // the real DOM structure where priceToPay comes AFTER the list price.
    const html = `
      <html><body>
        <div id="corePriceDisplay_desktop_feature_div">
          <span class="a-price a-text-price" data-a-color="secondary" data-a-strike="true">
            <span class="a-offscreen">92,49 €</span>
            <span aria-hidden="true">
              <span class="a-price-whole">92,</span>
              <span class="a-price-fraction">49</span>
            </span>
          </span>
          <span class="a-price priceToPay" data-a-color="price">
            <span class="a-offscreen">78,62 €</span>
            <span aria-hidden="true">
              <span class="a-price-whole">78,</span>
              <span class="a-price-fraction">62</span>
            </span>
          </span>
        </div>
        <input id="add-to-cart-button" />
      </body></html>
    `;
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    } as Response);
    const result = await scraper.scrape("https://amazon.es/dp/B001");
    expect(result?.price).toBe(78.62);
  });

  it("should parse price from .a-offscreen when available", async () => {
    // Amazon's .a-offscreen span contains the complete price string which is
    // more reliable than assembling whole + fraction parts.
    const html = `
      <html><body>
        <span class="a-price priceToPay">
          <span class="a-offscreen">34,99 €</span>
          <span aria-hidden="true">
            <span class="a-price-whole">34,</span>
            <span class="a-price-fraction">99</span>
          </span>
        </span>
        <input id="buy-now-button" />
      </body></html>
    `;
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      text: async () => html,
    } as Response);
    const result = await scraper.scrape("https://amazon.es/dp/B002");
    expect(result?.price).toBe(34.99);
    expect(result?.isAvailable).toBe(true);
  });
});
