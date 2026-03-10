import { describe, expect, it } from "vitest";
import {
  type ComparableItem,
  comparablePrice,
  compareByUnitPrice,
  effectivePrice,
  formatComparablePrice,
  formatWeight,
  inferComparisonMode,
  quantityLabel,
} from "./price-comparison";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Pañales Dodot T5 — 44-pack, no weight data */
const diaper44: ComparableItem = { price: 18.0, packageSize: 44 };
/** Pañales Dodot T5 — 22-pack, no weight data */
const diaper22: ComparableItem = { price: 10.0, packageSize: 22 };
/** Pañales Dodot T5 — 48-pack, Subscribe & Save price */
const diaper48sub: ComparableItem = {
  price: 20.0,
  subscribePrice: 17.0,
  packageSize: 48,
};

/** Leche entera — 1 L (1000 ml) */
const milk1L: ComparableItem = {
  price: 1.2,
  netWeight: 1000,
  netWeightUnit: "ml",
};
/** Leche entera — 6×1 L */
const milk6L: ComparableItem = {
  price: 6.5,
  packageSize: 6,
  netWeight: 1000,
  netWeightUnit: "ml",
};

/** Arroz — 1 kg (1000 g) */
const rice1kg: ComparableItem = {
  price: 1.5,
  netWeight: 1000,
  netWeightUnit: "g",
};
/** Arroz — 5 kg (5000 g) */
const rice5kg: ComparableItem = {
  price: 5.0,
  netWeight: 5000,
  netWeightUnit: "g",
};

/** No packaging data at all */
const noData: ComparableItem = { price: 3.99 };

/** Amazon product with shipping cost */
const withShipping: ComparableItem = {
  price: 13.99,
  shippingCost: 4.99,
  packageSize: 40,
};

// ---------------------------------------------------------------------------
// inferComparisonMode
// ---------------------------------------------------------------------------

describe("inferComparisonMode", () => {
  it("should return perUnit when items only have packageSize", () => {
    expect(inferComparisonMode([diaper44, diaper22, diaper48sub])).toBe(
      "perUnit",
    );
  });

  it("should return per100ml when items have ml netWeightUnit", () => {
    expect(inferComparisonMode([milk1L, milk6L])).toBe("per100ml");
  });

  it("should return per100g when items have g netWeightUnit", () => {
    expect(inferComparisonMode([rice1kg, rice5kg])).toBe("per100g");
  });

  it("should return rawPrice when no items have any sizing data", () => {
    expect(inferComparisonMode([noData, noData])).toBe("rawPrice");
  });

  it("should return rawPrice for an empty array", () => {
    expect(inferComparisonMode([])).toBe("rawPrice");
  });

  it("should use majority vote — g wins when more items have g than ml", () => {
    const mixed: ComparableItem[] = [
      { price: 2, netWeight: 500, netWeightUnit: "g" },
      { price: 3, netWeight: 500, netWeightUnit: "g" },
      { price: 1.5, netWeight: 1000, netWeightUnit: "ml" },
    ];
    expect(inferComparisonMode(mixed)).toBe("per100g");
  });

  it("should prefer per100g over perUnit on a tie in favour of weight", () => {
    // 2 g-weight + 2 unit-only → tie; g wins by tie-breaking order
    const tied: ComparableItem[] = [
      { price: 2, netWeight: 500, netWeightUnit: "g" },
      { price: 3, netWeight: 500, netWeightUnit: "g" },
      { price: 5, packageSize: 30 },
      { price: 6, packageSize: 40 },
    ];
    expect(inferComparisonMode(tied)).toBe("per100g");
  });
});

// ---------------------------------------------------------------------------
// effectivePrice
// ---------------------------------------------------------------------------

describe("effectivePrice", () => {
  it("should return price when no subscribePrice", () => {
    expect(effectivePrice(diaper44)).toBe(18.0);
  });

  it("should return subscribePrice when available", () => {
    expect(effectivePrice(diaper48sub)).toBe(17.0);
  });

  it("should add shippingCost when includeShipping is true", () => {
    expect(effectivePrice(withShipping, true)).toBeCloseTo(18.98);
  });

  it("should not add shippingCost when includeShipping is false (default)", () => {
    expect(effectivePrice(withShipping)).toBe(13.99);
  });

  it("should handle null shippingCost gracefully", () => {
    const item: ComparableItem = { price: 5, shippingCost: null };
    expect(effectivePrice(item, true)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// comparablePrice
// ---------------------------------------------------------------------------

describe("comparablePrice", () => {
  describe("perUnit mode", () => {
    it("should compute price per unit", () => {
      expect(comparablePrice(diaper44, "perUnit")).toBeCloseTo(18.0 / 44);
    });

    it("should use subscribePrice when available", () => {
      expect(comparablePrice(diaper48sub, "perUnit")).toBeCloseTo(17.0 / 48);
    });

    it("should return null when packageSize is missing", () => {
      expect(comparablePrice(noData, "perUnit")).toBeNull();
    });

    it("should return null when packageSize is null", () => {
      const item: ComparableItem = { price: 5, packageSize: null };
      expect(comparablePrice(item, "perUnit")).toBeNull();
    });
  });

  describe("per100ml mode", () => {
    it("should compute price per litre for a single unit", () => {
      // milk1L = 1.20€ / 1000ml → 1.20€/l
      expect(comparablePrice(milk1L, "per100ml")).toBeCloseTo(1.2);
    });

    it("should compute price per litre for a multi-pack", () => {
      // milk6L = 6.50€ / (6 × 1000ml) = 6.50/6000 × 1000 ≈ 1.083€/l
      expect(comparablePrice(milk6L, "per100ml")).toBeCloseTo(6.5 / 6);
    });

    it("should return null when netWeight is missing", () => {
      expect(comparablePrice(noData, "per100ml")).toBeNull();
    });

    it("should return null when netWeight is zero", () => {
      const item: ComparableItem = {
        price: 2,
        netWeight: 0,
        netWeightUnit: "ml",
      };
      expect(comparablePrice(item, "per100ml")).toBeNull();
    });
  });

  describe("per100g mode", () => {
    it("should compute price per kg", () => {
      // rice1kg = 1.50€ / 1000g → 1.50€/kg
      expect(comparablePrice(rice1kg, "per100g")).toBeCloseTo(1.5);
    });

    it("should compute price per kg for a larger pack", () => {
      // rice5kg = 5.00€ / 5000g → 1.00€/kg
      expect(comparablePrice(rice5kg, "per100g")).toBeCloseTo(1.0);
    });

    it("should return null when netWeight is missing", () => {
      expect(comparablePrice(noData, "per100g")).toBeNull();
    });
  });

  describe("rawPrice mode", () => {
    it("should return the effective price unchanged", () => {
      expect(comparablePrice(noData, "rawPrice")).toBe(3.99);
    });

    it("should use subscribePrice when available", () => {
      expect(comparablePrice(diaper48sub, "rawPrice")).toBe(17.0);
    });
  });

  describe("includeShipping", () => {
    it("should add shippingCost when includeShipping is true", () => {
      // withShipping: 13.99 + 4.99 = 18.98, packageSize 40
      const perUnit = comparablePrice(withShipping, "perUnit", true);
      expect(perUnit).toBeCloseTo(18.98 / 40);
    });

    it("should not add shippingCost when includeShipping is false (default)", () => {
      const perUnit = comparablePrice(withShipping, "perUnit");
      expect(perUnit).toBeCloseTo(13.99 / 40);
    });
  });
});

// ---------------------------------------------------------------------------
// compareByUnitPrice
// ---------------------------------------------------------------------------

describe("compareByUnitPrice", () => {
  it("should rank the cheaper per-unit diaper first", () => {
    // diaper44: 18/44 = 0.409€/pañal
    // diaper22: 10/22 = 0.454€/pañal
    // → diaper44 is cheaper per unit; should sort before diaper22
    const result = compareByUnitPrice(diaper44, diaper22, "perUnit");
    expect(result).toBeLessThan(0);
  });

  it("should sort items without unit data after items with unit data", () => {
    const result = compareByUnitPrice(noData, diaper44, "perUnit");
    expect(result).toBeGreaterThan(0);
  });

  it("should sort two no-data items by raw price", () => {
    const cheap: ComparableItem = { price: 1.0 };
    const expensive: ComparableItem = { price: 5.0 };
    expect(compareByUnitPrice(cheap, expensive, "rawPrice")).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// formatWeight
// ---------------------------------------------------------------------------

describe("formatWeight", () => {
  it("should format grams below 1000 as Xg", () => {
    expect(formatWeight(500, "g")).toBe("500g");
  });

  it("should format grams at 1000 as kg", () => {
    expect(formatWeight(1000, "g")).toContain("kg");
  });

  it("should format ml below 1000 as X ml", () => {
    expect(formatWeight(330, "ml")).toBe("330 ml");
  });

  it("should format ml at 1000 as L", () => {
    expect(formatWeight(1000, "ml")).toContain("L");
  });

  it("should format 1500 ml as 1.5 L", () => {
    expect(formatWeight(1500, "ml")).toContain("1,5");
    expect(formatWeight(1500, "ml")).toContain("L");
  });
});

// ---------------------------------------------------------------------------
// quantityLabel
// ---------------------------------------------------------------------------

describe("quantityLabel", () => {
  it("should show N uds for packageSize-only items", () => {
    expect(quantityLabel(diaper44)).toBe("44 uds");
  });

  it("should show weight for single-unit weight items", () => {
    expect(quantityLabel(milk1L)).toBe("1 L");
  });

  it("should show N×weight for multi-pack weight items", () => {
    expect(quantityLabel(milk6L)).toBe("6×1 L");
  });

  it("should show weight for a 500g rice bag", () => {
    expect(
      quantityLabel({ price: 1, netWeight: 500, netWeightUnit: "g" }),
    ).toBe("500g");
  });

  it("should return — for items with no sizing data", () => {
    expect(quantityLabel(noData)).toBe("—");
  });
});

// ---------------------------------------------------------------------------
// formatComparablePrice
// ---------------------------------------------------------------------------

describe("formatComparablePrice", () => {
  it("should use 3 decimal places for perUnit mode", () => {
    // 0.409 €/pañal → should show 3 decimals
    const result = formatComparablePrice(0.409, "perUnit");
    expect(result).toContain("0,409");
  });

  it("should use 2 decimal places for per100g mode", () => {
    const result = formatComparablePrice(1.5, "per100g");
    expect(result).toContain("1,50");
  });

  it("should use 2 decimal places for per100ml mode", () => {
    const result = formatComparablePrice(1.2, "per100ml");
    expect(result).toContain("1,20");
  });
});
