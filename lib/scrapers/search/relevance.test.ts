import { describe, expect, it } from "vitest";

import { filterVariantConflicts, isRelevant } from "./relevance";

// ── isRelevant ────────────────────────────────────────────────────────────────
describe("isRelevant", () => {
  it("should pass when all query tokens appear in the product name", () => {
    expect(
      isRelevant(
        "Dodot Sensitive Extra Talla 5 44 uds",
        "dodot sensitive talla 5",
      ),
    ).toBe(true);
  });

  it("should fail when a required brand token is missing", () => {
    expect(
      isRelevant("Pampers Baby Dry Talla 5", "dodot sensitive talla 5"),
    ).toBe(false);
  });

  it("should fail when the size number does not match", () => {
    expect(
      isRelevant(
        "Dodot Sensitive Extra Talla 4 48 uds",
        "dodot sensitive talla 5",
      ),
    ).toBe(false);
  });

  it("should pass for a water brand search", () => {
    expect(isRelevant("Agua mineral Bezoya 1,5 L", "bezoya")).toBe(true);
  });

  it("should pass for 'con gas' result when query is 'agua con gas bezoya'", () => {
    // "con" is a stop word but "gas" is a significant token
    expect(
      isRelevant("Bezoya agua con gas 750 ml", "agua con gas bezoya"),
    ).toBe(true);
  });
});

// ── filterVariantConflicts ────────────────────────────────────────────────────

type MinResult = { productName: string };

function results(...names: string[]): MinResult[] {
  return names.map((productName) => ({ productName }));
}

describe("filterVariantConflicts — no explicit gas preference in query", () => {
  it("should remove 'con gas' results when query has no gas preference", () => {
    const input = results(
      "Bezoya agua sin gas 1,5 L",
      "Bezoya agua con gas 750 ml",
      "Bezoya agua mineral 1 L",
    );
    const out = filterVariantConflicts(input, "agua bezoya");
    expect(out.map((r) => r.productName)).toEqual([
      "Bezoya agua sin gas 1,5 L",
      "Bezoya agua mineral 1 L",
    ]);
  });

  it("should remove 'carbonatada' results when query has no gas preference", () => {
    const input = results(
      "Font Vella agua mineral 1,5 L",
      "Font Vella carbonatada 750 ml",
    );
    const out = filterVariantConflicts(input, "font vella");
    expect(out.map((r) => r.productName)).toEqual([
      "Font Vella agua mineral 1,5 L",
    ]);
  });

  it("should return ALL results when every result is sparkling (sparkling-only brand safety)", () => {
    const input = results(
      "Vichy Catalan agua con gas 1 L",
      "Vichy Catalan agua con gas 1,2 L",
      "Perrier sparkling water 500 ml",
    );
    const out = filterVariantConflicts(input, "vichy catalan");
    // Filtering would remove everything → return the original set unchanged
    expect(out).toHaveLength(3);
  });

  it("should return ALL results when none of them have a gas marker", () => {
    const input = results(
      "Dodot Sensitive T5 44 uds",
      "Pampers Baby Dry T5 40 uds",
    );
    const out = filterVariantConflicts(input, "dodot talla 5");
    expect(out).toHaveLength(2);
  });
});

describe("filterVariantConflicts — query requests sparkling", () => {
  it("should keep sparkling results and remove 'sin gas' results", () => {
    const input = results(
      "Bezoya agua con gas 750 ml",
      "Bezoya agua sin gas 1,5 L",
      "Bezoya agua mineral 1 L", // no explicit gas marker → neutral → kept
    );
    const out = filterVariantConflicts(input, "agua con gas bezoya");
    // Only explicitly-still results removed; neutral ones pass through
    expect(out.map((r) => r.productName)).toEqual([
      "Bezoya agua con gas 750 ml",
      "Bezoya agua mineral 1 L",
    ]);
  });

  it("should keep all results when none say 'sin gas'", () => {
    const input = results(
      "Agua con gas Vichy 1 L",
      "Agua con gas San Pellegrino 750 ml",
    );
    const out = filterVariantConflicts(input, "agua con gas");
    expect(out).toHaveLength(2);
  });
});

describe("filterVariantConflicts — query explicitly requests still", () => {
  it("should remove sparkling results when query says 'sin gas'", () => {
    const input = results(
      "Bezoya agua sin gas 1,5 L",
      "Bezoya agua con gas 750 ml",
    );
    const out = filterVariantConflicts(input, "agua sin gas bezoya");
    expect(out.map((r) => r.productName)).toEqual([
      "Bezoya agua sin gas 1,5 L",
    ]);
  });
});

describe("filterVariantConflicts — Spanish diacritics", () => {
  it("should match 'carbonatada' after diacritic normalisation", () => {
    const input = results(
      "Agua mineral natural 1,5 L",
      "Agua carbonatada 500 ml",
    );
    const out = filterVariantConflicts(input, "agua");
    expect(out.map((r) => r.productName)).toEqual([
      "Agua mineral natural 1,5 L",
    ]);
  });
});
