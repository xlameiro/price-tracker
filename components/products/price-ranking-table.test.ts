import { describe, expect, it } from "vitest";
import {
  comparablePrice,
  inferComparisonMode,
  type PriceRow,
} from "./price-ranking-table";

function makeRow(overrides: Partial<PriceRow> = {}): PriceRow {
  return {
    storeId: "test",
    storeName: "Test Store",
    storeUrl: "https://example.com",
    freeShippingThreshold: null,
    shippingNote: null,
    price: 10,
    subscribePrice: null,
    packageSize: null,
    netWeight: null,
    netWeightUnit: null,
    shippingCost: null,
    productUrl: null,
    scrapedAt: new Date(),
    ...overrides,
  };
}

describe("inferComparisonMode", () => {
  it("should return rawPrice when no rows have quantity data", () => {
    expect(inferComparisonMode([makeRow(), makeRow()])).toBe("rawPrice");
  });

  it("should return per100g when all rows have g weight", () => {
    const rows = [
      makeRow({ netWeight: 500, netWeightUnit: "g" }),
      makeRow({ netWeight: 1000, netWeightUnit: "g" }),
    ];
    expect(inferComparisonMode(rows)).toBe("per100g");
  });

  it("should return per100ml when all rows have ml weight", () => {
    const rows = [
      makeRow({ netWeight: 500, netWeightUnit: "ml" }),
      makeRow({ netWeight: 1000, netWeightUnit: "ml" }),
    ];
    expect(inferComparisonMode(rows)).toBe("per100ml");
  });

  it("should return perUnit when all rows have packageSize only", () => {
    const rows = [makeRow({ packageSize: 42 }), makeRow({ packageSize: 44 })];
    expect(inferComparisonMode(rows)).toBe("perUnit");
  });

  it("should use majority vote — perUnit wins over per100g when more rows have units", () => {
    // 2 rows with bad netWeight vs 8 rows with correct packageSize → perUnit
    const rows = [
      makeRow({ netWeight: 16000, netWeightUnit: "g" }),
      makeRow({ netWeight: 17000, netWeightUnit: "g" }),
      makeRow({ packageSize: 42 }),
      makeRow({ packageSize: 42 }),
      makeRow({ packageSize: 44 }),
      makeRow({ packageSize: 44 }),
      makeRow({ packageSize: 42 }),
      makeRow({ packageSize: 88 }),
      makeRow({ packageSize: 176 }),
      makeRow({ packageSize: 168 }),
    ];
    expect(inferComparisonMode(rows)).toBe("perUnit");
  });

  it("should return per100g when more rows have g weight than units", () => {
    const rows = [
      makeRow({ netWeight: 500, netWeightUnit: "g" }),
      makeRow({ netWeight: 1000, netWeightUnit: "g" }),
      makeRow({ netWeight: 750, netWeightUnit: "g" }),
      makeRow({ packageSize: 6 }),
      makeRow({ packageSize: 12 }),
    ];
    expect(inferComparisonMode(rows)).toBe("per100g");
  });
});

describe("comparablePrice", () => {
  it("should return null for per100g when row has no netWeight", () => {
    const row = makeRow({ packageSize: 42, price: 23.2 });
    expect(comparablePrice(row, "per100g")).toBeNull();
  });

  it("should correctly compute per100g price", () => {
    const row = makeRow({ netWeight: 500, netWeightUnit: "g", price: 2.5 });
    expect(comparablePrice(row, "per100g")).toBeCloseTo(0.5);
  });

  it("should correctly compute perUnit price", () => {
    const row = makeRow({ packageSize: 42, price: 23.2 });
    expect(comparablePrice(row, "perUnit")).toBeCloseTo(23.2 / 42);
  });

  it("should use subscribePrice over price when available", () => {
    const row = makeRow({ packageSize: 42, price: 23.2, subscribePrice: 20.0 });
    expect(comparablePrice(row, "perUnit")).toBeCloseTo(20.0 / 42);
  });

  it("should return null for per100ml when row has no netWeight", () => {
    const row = makeRow({ packageSize: 6, price: 5 });
    expect(comparablePrice(row, "per100ml")).toBeNull();
  });
});
