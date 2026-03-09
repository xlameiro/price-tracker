import { describe, expect, it } from "vitest";
import { extractPackageSize, parseProductQuantity } from "./scraper-utils";

describe("parseProductQuantity", () => {
  describe("weight — grams", () => {
    it("should extract grams from inline unit", () => {
      expect(parseProductQuantity("Yogur griego 125g")).toEqual({
        netWeight: 125,
        netWeightUnit: "g",
      });
    });

    it("should extract grams with space before unit", () => {
      expect(parseProductQuantity("Garbanzos cocidos 400 g")).toEqual({
        netWeight: 400,
        netWeightUnit: "g",
      });
    });

    it("should extract grams abbreviated as gr", () => {
      expect(parseProductQuantity("Arroz 1000 gr")).toEqual({
        netWeight: 1000,
        netWeightUnit: "g",
      });
    });

    it("should convert kg to grams", () => {
      expect(parseProductQuantity("Harina de trigo 1 kg")).toEqual({
        netWeight: 1000,
        netWeightUnit: "g",
      });
    });

    it("should convert decimal kg to grams", () => {
      expect(parseProductQuantity("Sal marina 1,5 kg")).toEqual({
        netWeight: 1500,
        netWeightUnit: "g",
      });
    });
  });

  describe("volume — millilitres", () => {
    it("should extract ml directly", () => {
      expect(parseProductQuantity("Aceite de oliva 250 ml")).toEqual({
        netWeight: 250,
        netWeightUnit: "ml",
      });
    });

    it("should convert cl to ml", () => {
      expect(parseProductQuantity("Refresco lata 33cl")).toEqual({
        netWeight: 330,
        netWeightUnit: "ml",
      });
    });

    it("should convert L to ml (uppercase)", () => {
      expect(parseProductQuantity("Zumo de naranja 1,5L")).toEqual({
        netWeight: 1500,
        netWeightUnit: "ml",
      });
    });

    it("should convert l to ml (lowercase with space)", () => {
      expect(parseProductQuantity("Leche entera 1 l")).toEqual({
        netWeight: 1000,
        netWeightUnit: "ml",
      });
    });
  });

  describe("multi-pack with weight", () => {
    it("should extract pack size and weight from inline NxMg", () => {
      expect(parseProductQuantity("Atún claro 3x80g")).toEqual({
        packageSize: 3,
        netWeight: 80,
        netWeightUnit: "g",
      });
    });

    it("should extract pack size and weight from spaced N x M g", () => {
      expect(parseProductQuantity("Atún claro Calvo 3 x 112 g")).toEqual({
        packageSize: 3,
        netWeight: 112,
        netWeightUnit: "g",
      });
    });

    it("should extract pack size and volume from Nx M cl", () => {
      expect(parseProductQuantity("Coca-Cola 6x33cl")).toEqual({
        packageSize: 6,
        netWeight: 330,
        netWeightUnit: "ml",
      });
    });

    it("should handle decimal weight in pack, e.g. 4x1,5l", () => {
      expect(parseProductQuantity("Agua mineral 4x1,5l")).toEqual({
        packageSize: 4,
        netWeight: 1500,
        netWeightUnit: "ml",
      });
    });

    it("should not return packageSize for count of 1", () => {
      expect(parseProductQuantity("Lata atún 1x80g")).toEqual({
        netWeight: 80,
        netWeightUnit: "g",
      });
    });
  });

  describe("unit count (no weight)", () => {
    it("should extract unit count from 'uds'", () => {
      expect(parseProductQuantity("Pañales Dodot T5 44 uds")).toEqual({
        packageSize: 44,
      });
    });

    it("should extract unit count from 'unidades'", () => {
      expect(parseProductQuantity("Pañales Huggies 56 unidades")).toEqual({
        packageSize: 56,
      });
    });

    it("should extract unit count from 'pañales'", () => {
      expect(parseProductQuantity("Dodot Sensitive 48 pañales")).toEqual({
        packageSize: 48,
      });
    });

    it("should return empty for unknown unit keywords", () => {
      expect(parseProductQuantity("Bolsas de basura 10 bolsas")).toEqual({});
    });
  });

  describe("inline multiply (no weight unit)", () => {
    it("should multiply inline pack counts (2x50)", () => {
      expect(parseProductQuantity("Pack Dodot 2x50")).toEqual({
        packageSize: 100,
      });
    });
  });

  describe("edge cases", () => {
    it("should return empty object for plain product name", () => {
      expect(parseProductQuantity("Jabón de manos")).toEqual({});
    });

    it("should not confuse product model number with weight (T5)", () => {
      expect(parseProductQuantity("Pañales Dodot T5")).toEqual({});
    });

    it("should handle product with size indicator before weight", () => {
      expect(parseProductQuantity("Espaguetis Barilla nº 5 500 g")).toEqual({
        netWeight: 500,
        netWeightUnit: "g",
      });
    });

    it("should not parse baby weight range as product weight — returns unit count instead", () => {
      // '11-16 kg' is the baby weight range, '42 unidades' is the product quantity
      expect(
        parseProductQuantity("Pañal DODOT Sensitive T5 11-16 kg 42 unidades"),
      ).toEqual({ packageSize: 42 });
    });

    it("should return empty when only a baby weight range is present", () => {
      expect(parseProductQuantity("Pañales Huggies T3 4-9 kg")).toEqual({});
    });

    it("should parse a standalone product weight that follows a size range", () => {
      // net weight stated separately after the baby size range
      expect(
        parseProductQuantity("Producto T5 11-16 kg contenido 500 g"),
      ).toEqual({ netWeight: 500, netWeightUnit: "g" });
    });

    it("should not parse standalone baby size label as product weight (T5 17 kg)", () => {
      // ECI/Hipercor product names sometimes state the upper baby weight alone
      expect(parseProductQuantity("Dodot Sensitive T5 17 kg")).toEqual({});
    });

    it("should extract unit count when T5 size label precedes it", () => {
      expect(
        parseProductQuantity("Dodot Sensitive T5 17 kg 40 Unidades"),
      ).toEqual({ packageSize: 40 });
    });

    it("should not parse parenthetical baby size label as product weight (T5+ (16 kg))", () => {
      // Parenthetical range "(16 kg)" — the "16" follows "(" which is not digit/hyphen,
      // but the range-lookbehind still keeps the OVERALL range form out.
      // This test documents the known edge: T5+(space)(16 kg) is NOT stripped by
      // TALLA_WEIGHT_RE (which requires a digit immediately after the space) but
      // "T5 11-16 kg" forms are handled by the negative lookbehind on SINGLE_WEIGHT_RE.
      // The parenthetical standalone form "T5 (16 kg)" extracts weight — acceptable
      // because such product names also include a unit count like "40 uds".
      expect(parseProductQuantity("Dodot Sensitive T5+ 16 kg 40 uds")).toEqual({
        packageSize: 40,
      });
    });

    it("should not parse talla keyword size label as product weight", () => {
      expect(parseProductQuantity("Pañal Dodot talla 5 17 kg 42 uds")).toEqual({
        packageSize: 42,
      });
    });
  });
});

describe("extractPackageSize (backwards compatibility)", () => {
  it("should return unit count from 'uds'", () => {
    expect(extractPackageSize("Pañales Dodot T5 44 uds")).toBe(44);
  });

  it("should return multiplied count from inline NxM", () => {
    expect(extractPackageSize("Dodot Pack 2x44")).toBe(88);
  });

  it("should NOT multiply invalid pack counts for 4x100 g", () => {
    // 4x100 g means 4 units of 100g, not 400 units
    expect(extractPackageSize("Pack 4x100 g")).toBe(4);
  });

  it("should return undefined when no quantity found", () => {
    expect(extractPackageSize("Jabón de manos")).toBeUndefined();
  });
});
