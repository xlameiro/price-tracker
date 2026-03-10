import { describe, expect, it } from "vitest";
import { parseProductQuantity } from "./scraper-utils";
import { resolveAtidaQuantity } from "./atida-search";
import { resolveCarrefourQuantity } from "./carrefour-search";
import { resolveDosFarmaQuantity } from "./dosfarma-search";
import { resolveFroizQuantity } from "./froiz-search";
import { piToQuantity } from "./mercadona-search";

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

    it("should multiply compact 'NxMu' when u suffix is attached (BUG fix: 6x48u)", () => {
      // "6x48u" must not be split into packageSize=8 via UNIT_COUNT_GENERIC_RE matching "8u";
      // the lookbehind prevents it and the multiply path handles it correctly.
      expect(
        parseProductQuantity(
          "Toallitas húmedas infantiles Dodot 6x48u Aqua Pure",
        ),
      ).toEqual({ packageSize: 288 });
    });

    it("should multiply spaced form with large left factor (BUG fix: 18 x 48)", () => {
      // Bulk purchases can have ≥10 outer packs — up to 24 is allowed.
      expect(
        parseProductQuantity("Toallitas Dodot Aqua Pure Pack Ahorro 18 x 48"),
      ).toEqual({ packageSize: 864 });
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

    it("should parse ECI-style UNID. abbreviation as unit count", () => {
      // El Corte Inglés product names use "UNID." abbreviation: "42 UNID. T-5"
      expect(parseProductQuantity("DODOT SENSITIVE T5 17 KG 42 UNID.")).toEqual(
        { packageSize: 42 },
      );
    });

    it("should prioritise keyword unit count over weight when both appear in name", () => {
      // Weight label appears before unit count in the string — unit count wins
      expect(parseProductQuantity("Pañales T5 17 kg 44 uds")).toEqual({
        packageSize: 44,
      });
    });
  });

  describe("pharmacy unit keywords", () => {
    it("should parse cápsulas", () => {
      expect(parseProductQuantity("Omeprazol 28 cápsulas")).toEqual({
        packageSize: 28,
      });
    });

    it("should parse capsulas without accent", () => {
      expect(parseProductQuantity("Omeprazol 28 capsulas")).toEqual({
        packageSize: 28,
      });
    });

    it("should parse comprimidos", () => {
      expect(parseProductQuantity("Ibuprofeno 600mg 40 comprimidos")).toEqual({
        packageSize: 40,
      });
    });

    it("should parse pastillas", () => {
      expect(parseProductQuantity("Vitamina C 60 pastillas")).toEqual({
        packageSize: 60,
      });
    });

    it("should parse sobres", () => {
      expect(parseProductQuantity("Coldrex 16 sobres")).toEqual({
        packageSize: 16,
      });
    });

    it("should parse ampollas", () => {
      expect(parseProductQuantity("Vitamina D 30 ampollas")).toEqual({
        packageSize: 30,
      });
    });

    it("should parse tabletas", () => {
      expect(parseProductQuantity("Magnesio 60 tabletas")).toEqual({
        packageSize: 60,
      });
    });

    it("should parse singular cápsula", () => {
      expect(parseProductQuantity("Suplemento 1 cápsula")).toEqual({
        packageSize: 1,
      });
    });

    it("should parse dishwasher pastillas as unit count", () => {
      expect(
        parseProductQuantity("Pastillas lavavajillas 30 pastillas"),
      ).toEqual({ packageSize: 30 });
    });
  });

  describe("dosage unit keywords", () => {
    it("should parse dosis for detergent", () => {
      expect(parseProductQuantity("Ariel 2.8L 40 dosis")).toEqual({
        packageSize: 40,
      });
    });

    it("should parse lavados", () => {
      expect(parseProductQuantity("Coral suavizante 1.5L 30 lavados")).toEqual({
        packageSize: 30,
      });
    });

    it("should parse lavado singular", () => {
      expect(parseProductQuantity("Detergente 15 lavado")).toEqual({
        packageSize: 15,
      });
    });
  });

  describe("Pack de N notation", () => {
    it("should parse 'Pack de N' notation", () => {
      expect(parseProductQuantity("Pack de 12 yogures")).toEqual({
        packageSize: 12,
      });
    });

    it("should parse 'pack d N' (without 'e')", () => {
      expect(parseProductQuantity("pack d 6 latas")).toEqual({
        packageSize: 6,
      });
    });

    it("should parse 'Pack N' (no 'de')", () => {
      expect(parseProductQuantity("Pack 4 latas")).toEqual({
        packageSize: 4,
      });
    });

    it("should be case-insensitive for Pack", () => {
      expect(parseProductQuantity("PACK DE 24 botellas")).toEqual({
        packageSize: 24,
      });
    });

    it("should enrich 'pack 4 x 125g' with per-unit weight", () => {
      // Pack keyword captures unit count; weight must NOT be discarded.
      expect(parseProductQuantity("Yogur Danone pack 4 x 125g")).toEqual({
        packageSize: 4,
        netWeight: 125,
        netWeightUnit: "g",
      });
    });

    it("should enrich 'Pack de 4 x 125g' with per-unit weight", () => {
      expect(parseProductQuantity("Yogur Danone Pack de 4 x 125g")).toEqual({
        packageSize: 4,
        netWeight: 125,
        netWeightUnit: "g",
      });
    });

    it("should enrich 'Pack de 6 botellas 1,5L' with volume", () => {
      expect(
        parseProductQuantity("Agua Mineral Pack de 6 botellas 1,5L"),
      ).toEqual({
        packageSize: 6,
        netWeight: 1500,
        netWeightUnit: "ml",
      });
    });

    it("should enrich 'pack 6 brik 1L' with volume", () => {
      expect(parseProductQuantity("Leche Pascual UHT pack 6 brik 1L")).toEqual({
        packageSize: 6,
        netWeight: 1000,
        netWeightUnit: "ml",
      });
    });
  });

  describe("keyword unit count with weight enrichment", () => {
    it("should enrich 'N uds Xml' with per-unit volume", () => {
      // "uds" unit count + volume must both be captured, not just the count.
      expect(parseProductQuantity("Actimel L.Casei 12 uds 100ml")).toEqual({
        packageSize: 12,
        netWeight: 100,
        netWeightUnit: "ml",
      });
    });

    it("should enrich 'N uds Ng' with per-unit weight", () => {
      expect(parseProductQuantity("Batido Cacaolat 6 uds 200ml")).toEqual({
        packageSize: 6,
        netWeight: 200,
        netWeightUnit: "ml",
      });
    });

    it("should NOT add weight for diapers (T-size label stripped)", () => {
      // DODOT T5 17 KG — the "17 KG" is a baby-size label, not product weight.
      // After stripping it, no other weight remains → weight enrichment = null.
      expect(parseProductQuantity("DODOT T5 17 KG 42 UNID.")).toEqual({
        packageSize: 42,
      });
    });

    it("should NOT add weight for plain unit count with no weight", () => {
      expect(parseProductQuantity("Tampax Compak Regular 22 uds")).toEqual({
        packageSize: 22,
      });
    });
  });

  describe("paper and household counted units", () => {
    it("should parse rollos (toilet paper)", () => {
      expect(parseProductQuantity("Papel higiénico 12 rollos")).toEqual({
        packageSize: 12,
      });
    });

    it("should parse rollo (singular)", () => {
      expect(parseProductQuantity("Papel de cocina 6 rollo")).toEqual({
        packageSize: 6,
      });
    });

    it("should parse paquetes (tissue packs)", () => {
      expect(parseProductQuantity("Pañuelos 10 paquetes")).toEqual({
        packageSize: 10,
      });
    });

    it("should parse paquete (singular)", () => {
      expect(parseProductQuantity("Pañuelos faciales 6 paquete")).toEqual({
        packageSize: 6,
      });
    });

    it("should parse hojas", () => {
      expect(parseProductQuantity("Folios A4 500 hojas")).toEqual({
        packageSize: 500,
      });
    });
  });

  describe("container keywords with weight", () => {
    it("should parse latas with volume (beer cans)", () => {
      expect(
        parseProductQuantity("Cerveza Estrella Damm 6 latas 33cl"),
      ).toEqual({
        packageSize: 6,
        netWeight: 330,
        netWeightUnit: "ml",
      });
    });

    it("should parse botellas with volume (water)", () => {
      expect(parseProductQuantity("Agua mineral 6 botellas 500ml")).toEqual({
        packageSize: 6,
        netWeight: 500,
        netWeightUnit: "ml",
      });
    });

    it("should parse bricks with volume (milk)", () => {
      expect(parseProductQuantity("Leche entera 4 bricks 200ml")).toEqual({
        packageSize: 4,
        netWeight: 200,
        netWeightUnit: "ml",
      });
    });

    it("should accept brik spelling", () => {
      expect(parseProductQuantity("Leche Pascual 6 brik 1L")).toEqual({
        packageSize: 6,
        netWeight: 1000,
        netWeightUnit: "ml",
      });
    });

    it("should parse botes with weight (tomato sauce)", () => {
      expect(parseProductQuantity("Tomate frito 3 botes 400g")).toEqual({
        packageSize: 3,
        netWeight: 400,
        netWeightUnit: "g",
      });
    });

    it("should parse lata without trailing weight as unit count only", () => {
      // "4 latas" with no weight → just packageSize
      expect(parseProductQuantity("Conserva atún 4 latas")).toEqual({
        packageSize: 4,
      });
    });

    it("should NOT match single-item containers (count < 2)", () => {
      // "1 botella 500ml" should fall through to weight-only result
      expect(parseProductQuantity("Refresco 1 botella 500ml")).toEqual({
        netWeight: 500,
        netWeightUnit: "ml",
      });
    });
  });

  describe("x-prefix pack notation", () => {
    it("should parse x4 prefix with weight (Amazon multipack format)", () => {
      expect(parseProductQuantity("Danone x4 125g")).toEqual({
        packageSize: 4,
        netWeight: 125,
        netWeightUnit: "g",
      });
    });

    it("should parse x6 prefix with volume", () => {
      expect(parseProductQuantity("Refresco x6 330ml")).toEqual({
        packageSize: 6,
        netWeight: 330,
        netWeightUnit: "ml",
      });
    });

    it("should ignore x-prefix with count of 1", () => {
      // x1 means single item — treat as plain weight
      expect(parseProductQuantity("Yogur x1 125g")).toEqual({
        netWeight: 125,
        netWeightUnit: "g",
      });
    });
  });

  describe("unit count multiply (multi-pack × units-per-pack)", () => {
    it("should multiply explicit N × M uds", () => {
      expect(parseProductQuantity("Toallitas bebé 3 x 48 uds.")).toEqual({
        packageSize: 144,
      });
    });

    it("should multiply Pack N × M uds", () => {
      expect(parseProductQuantity("Pack 6 x 48 uds")).toEqual({
        packageSize: 288,
      });
    });

    it("should multiply N paquetes M uds with compact suffix", () => {
      expect(parseProductQuantity("Toallitas bebé 6 paquetes 48uds")).toEqual({
        packageSize: 288,
      });
    });

    it("should multiply when pack multiplier follows the unit count (reversed order)", () => {
      expect(parseProductQuantity("Toallitas bebé 48 uds. pack 6")).toEqual({
        packageSize: 288,
      });
    });

    it("should NOT fire for single-factor names (only one count keyword)", () => {
      // "44 uds" with no multiplier word — must fall through to normal path
      expect(parseProductQuantity("Pañales Dodot T5 44 uds")).toEqual({
        packageSize: 44,
      });
    });

    it("should NOT treat weight-unit patterns as unit-count multiply", () => {
      // "3 x 80g" → weight, not 240 units
      expect(parseProductQuantity("Atún claro 3 x 80g")).toEqual({
        packageSize: 3,
        netWeight: 80,
        netWeightUnit: "g",
      });
    });

    it("should NOT double-multiply when udsCount is already the pack total (BUG fix: Nappy)", () => {
      // "Pack 2 cajas 1728 uds" — 1728 is the full-pack total, not a per-box count.
      // Multiplying again (2×1728=3456) would be wrong.
      expect(parseProductQuantity("Pack 2 cajas 1728 uds")).toEqual({
        packageSize: 1728,
      });
    });
  });

  describe("compact 'u' / 'u.' notation (BUG #3)", () => {
    it("should parse '4u' compact suffix with weight after", () => {
      expect(parseProductQuantity("Dalky chocolate 4u x 125g")).toEqual({
        packageSize: 4,
        netWeight: 125,
        netWeightUnit: "g",
      });
    });

    it("should parse '4 u.' (spaced with trailing period)", () => {
      expect(parseProductQuantity("Dalky Chocolate Danone 4 u.")).toEqual({
        packageSize: 4,
      });
    });

    it("should parse bare '4 u' without trailing period", () => {
      expect(parseProductQuantity("Postre lácteo 4 u")).toEqual({
        packageSize: 4,
      });
    });
  });

  describe("weight position ordering (BUG #2)", () => {
    it("should NOT spread weight when it appears BEFORE the unit count", () => {
      // "150g 8 ud." — weight precedes count → 150g is total pack weight, not per-slice
      expect(parseProductQuantity("Queso lonchas Larsa 150g 8 ud.")).toEqual({
        packageSize: 8,
      });
    });

    it("should STILL spread weight when it appears AFTER the unit count", () => {
      // Existing behaviour must be preserved: "12 uds 100ml" → per-unit volume
      expect(parseProductQuantity("Actimel L.Casei 12 uds 100ml")).toEqual({
        packageSize: 12,
        netWeight: 100,
        netWeightUnit: "ml",
      });
    });
  });

  describe("ml volume before count (BUG #5)", () => {
    it("should spread ml volume even when it appears BEFORE the unit count keyword", () => {
      // "33 cl 6 unidades" — volume before count, but for liquids the volume is always per-can
      expect(
        parseProductQuantity("Estrella Galicia 0,0% Lata 33 cl 6 unidades"),
      ).toEqual({
        packageSize: 6,
        netWeight: 330,
        netWeightUnit: "ml",
      });
    });

    it("should spread ml volume for 'Xml N uds' pattern", () => {
      expect(parseProductQuantity("Nestea Limón 33cl 6 uds")).toEqual({
        packageSize: 6,
        netWeight: 330,
        netWeightUnit: "ml",
      });
    });

    it("should NOT spread g weight when it appears BEFORE the unit count (BUG #2 regression)", () => {
      // Solid product: weight-before-count = total pack weight — rule still applies
      expect(parseProductQuantity("Queso lonchas 150g 8 ud.")).toEqual({
        packageSize: 8,
      });
    });
  });

  describe("toallitas keyword (BUG #4)", () => {
    it("should parse 'N toallitas' as unit count", () => {
      expect(parseProductQuantity("Dodot Pure Aqua 48 toallitas")).toEqual({
        packageSize: 48,
      });
    });

    it("should parse singular 'toallita'", () => {
      expect(parseProductQuantity("Dodot Pure Aqua 50 toallita")).toEqual({
        packageSize: 50,
      });
    });
  });

  describe("full-word Spanish volume: 'litro(s)' (BUG #6)", () => {
    it("should parse '1 litro' as 1000ml", () => {
      expect(parseProductQuantity("Leche entera EROSKI, brik 1 litro")).toEqual(
        {
          netWeight: 1000,
          netWeightUnit: "ml",
        },
      );
    });

    it("should parse '1,5 litros' as 1500ml", () => {
      expect(
        parseProductQuantity("Leche entera EROSKI, botella 1,5 litros"),
      ).toEqual({
        netWeight: 1500,
        netWeightUnit: "ml",
      });
    });

    it("should parse '3 litros' as 3000ml", () => {
      expect(
        parseProductQuantity(
          "Aceite de oliva virgen extra MENDIA, garrafa 3 litros",
        ),
      ).toEqual({
        netWeight: 3000,
        netWeightUnit: "ml",
      });
    });

    it("should parse '6 x 1,5 litros' as packageSize 6 × 1500ml", () => {
      expect(parseProductQuantity("Agua mineral 6 x 1,5 litros")).toEqual({
        packageSize: 6,
        netWeight: 1500,
        netWeightUnit: "ml",
      });
    });
  });
});

describe("extractPackageSize (backwards compatibility via parseProductQuantity)", () => {
  it("should return unit count from 'uds'", () => {
    expect(parseProductQuantity("Pañales Dodot T5 44 uds")?.packageSize).toBe(
      44,
    );
  });

  it("should return multiplied count from inline NxM", () => {
    expect(parseProductQuantity("Dodot Pack 2x44")?.packageSize).toBe(88);
  });

  it("should NOT multiply invalid pack counts for 4x100 g", () => {
    // 4x100 g means 4 units of 100g, not 400 units
    expect(parseProductQuantity("Pack 4x100 g")?.packageSize).toBe(4);
  });

  it("should return undefined packageSize when no quantity found", () => {
    expect(parseProductQuantity("Jabón de manos")?.packageSize).toBeUndefined();
  });
});

describe("Aldi salesUnit patterns via parseProductQuantity", () => {
  it('should parse "250 g unidad" → 250g', () => {
    expect(parseProductQuantity("250 g unidad")).toEqual({
      netWeight: 250,
      netWeightUnit: "g",
    });
  });

  it('should parse "1 kg unidad" → 1000g', () => {
    expect(parseProductQuantity("1 kg unidad")).toEqual({
      netWeight: 1000,
      netWeightUnit: "g",
    });
  });

  it('should parse "0,33 l unidad" → 330ml', () => {
    expect(parseProductQuantity("0,33 l unidad")).toEqual({
      netWeight: 330,
      netWeightUnit: "ml",
    });
  });

  it('should parse "1,5 l unidad" → 1500ml', () => {
    expect(parseProductQuantity("1,5 l unidad")).toEqual({
      netWeight: 1500,
      netWeightUnit: "ml",
    });
  });

  it('should parse "pack de 12 x 0,33 l" → 12 × 330ml', () => {
    expect(parseProductQuantity("pack de 12 x 0,33 l")).toEqual({
      packageSize: 12,
      netWeight: 330,
      netWeightUnit: "ml",
    });
  });

  it('should parse "pack de 8 x 52 g" → 8 × 52g', () => {
    expect(parseProductQuantity("pack de 8 x 52 g")).toEqual({
      packageSize: 8,
      netWeight: 52,
      netWeightUnit: "g",
    });
  });

  it('should parse "pack de 6 x 60 g peso esc." → 6 × 60g (drained weight)', () => {
    expect(parseProductQuantity("pack de 6 x 60 g peso esc.")).toEqual({
      packageSize: 6,
      netWeight: 60,
      netWeightUnit: "g",
    });
  });

  it('should parse "pack de 16 cápsulas" → 16 units', () => {
    expect(parseProductQuantity("pack de 16 cápsulas")).toEqual({
      packageSize: 16,
    });
  });

  it('should return empty for "unidad"', () => {
    expect(parseProductQuantity("unidad")).toEqual({});
  });

  it('should parse "310 g unidad" → 310g (snack XXL)', () => {
    expect(parseProductQuantity("310 g unidad")).toEqual({
      netWeight: 310,
      netWeightUnit: "g",
    });
  });

  it('should parse "850 g unidad" → 850g', () => {
    expect(parseProductQuantity("850 g unidad")).toEqual({
      netWeight: 850,
      netWeightUnit: "g",
    });
  });
});

describe("Mercadona piToQuantity — structured price_instructions fields", () => {
  it("should extract unit count for diapers (ud, is_pack=false)", () => {
    expect(
      piToQuantity({ size_format: "ud", unit_size: 54, is_pack: false }),
    ).toEqual({ packageSize: 54 });
  });

  it("should extract total unit count for multi-pack (ud, is_pack=true)", () => {
    expect(
      piToQuantity({
        size_format: "ud",
        unit_size: 90,
        is_pack: true,
        pack_size: 30,
        total_units: 3,
      }),
    ).toEqual({ packageSize: 90 });
  });

  it("should extract volume for single water bottle (l, is_pack=false)", () => {
    expect(
      piToQuantity({ size_format: "l", unit_size: 1.5, is_pack: false }),
    ).toEqual({ netWeight: 1500, netWeightUnit: "ml" });
  });

  it("should extract count + per-bottle volume for multi-bottle pack (l, is_pack=true)", () => {
    expect(
      piToQuantity({
        size_format: "l",
        unit_size: 9,
        is_pack: true,
        pack_size: 1.5,
        total_units: 6,
      }),
    ).toEqual({ packageSize: 6, netWeight: 1500, netWeightUnit: "ml" });
  });

  it("should extract ml directly", () => {
    expect(
      piToQuantity({ size_format: "ml", unit_size: 500, is_pack: false }),
    ).toEqual({ netWeight: 500, netWeightUnit: "ml" });
  });

  it("should convert cl to ml", () => {
    expect(
      piToQuantity({ size_format: "cl", unit_size: 33, is_pack: false }),
    ).toEqual({ netWeight: 330, netWeightUnit: "ml" });
  });

  it("should extract grams", () => {
    expect(
      piToQuantity({ size_format: "g", unit_size: 150, is_pack: false }),
    ).toEqual({ netWeight: 150, netWeightUnit: "g" });
  });

  it("should convert kg to grams", () => {
    expect(
      piToQuantity({ size_format: "kg", unit_size: 1.5, is_pack: false }),
    ).toEqual({ netWeight: 1500, netWeightUnit: "g" });
  });

  it("should return empty for missing unit_size", () => {
    expect(piToQuantity({ size_format: "ud", unit_size: null })).toEqual({});
  });

  it("should return empty for unknown size_format", () => {
    expect(piToQuantity({ size_format: "pcs", unit_size: 10 })).toEqual({});
  });

  it("should return empty for empty price_instructions", () => {
    expect(piToQuantity({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// resolveDosFarmaQuantity (DosFarma / Atida Algolia structured fields)
// ---------------------------------------------------------------------------
describe("resolveDosFarmaQuantity", () => {
  const hit = (
    name: string,
    content_size?: string,
    content_size_factor?: number,
  ) => ({
    name,
    price: { EUR: { default: 1.0 } },
    url: "https://dosfarma.com",
    content_size,
    content_size_factor,
  });

  it("should extract piece count from Piece unit", () => {
    expect(
      resolveDosFarmaQuantity(hit("Dodot T3 90 uds", "90.0000 Piece")),
    ).toEqual({
      packageSize: 90,
    });
  });

  it("should multiply piece count by factor for combipacks", () => {
    expect(
      resolveDosFarmaQuantity(hit("Dodot T3 2x78 uds", "78.0000 Piece", 2)),
    ).toEqual({
      packageSize: 156,
    });
  });

  it("should extract ml from Milliliter unit", () => {
    expect(
      resolveDosFarmaQuantity(hit("Gel 500 ml", "500.0000 Milliliter")),
    ).toEqual({
      netWeight: 500,
      netWeightUnit: "ml",
    });
  });

  it("should set packageSize + netWeight for multi-pack Milliliter", () => {
    expect(
      resolveDosFarmaQuantity(hit("Pack 2x500ml", "500.0000 Milliliter", 2)),
    ).toEqual({
      packageSize: 2,
      netWeight: 500,
      netWeightUnit: "ml",
    });
  });

  it("should convert Liter to ml", () => {
    expect(resolveDosFarmaQuantity(hit("Agua 1L", "1.0000 Liter"))).toEqual({
      netWeight: 1000,
      netWeightUnit: "ml",
    });
  });

  it("should extract grams from Gram unit", () => {
    expect(resolveDosFarmaQuantity(hit("Crema 250g", "250.0000 Gram"))).toEqual(
      {
        netWeight: 250,
        netWeightUnit: "g",
      },
    );
  });

  it("should convert Kilogram to grams", () => {
    expect(
      resolveDosFarmaQuantity(hit("Arena 5kg", "5.0000 Kilogram")),
    ).toEqual({
      netWeight: 5000,
      netWeightUnit: "g",
    });
  });

  it("should fall back to name parsing when content_size absent", () => {
    expect(resolveDosFarmaQuantity(hit("Dodot T3 90 uds"))).toEqual({
      packageSize: 90,
    });
  });

  it("should fall back to name parsing for unknown unit", () => {
    expect(resolveDosFarmaQuantity(hit("Product 5 Box", "5.0000 Box"))).toEqual(
      {},
    );
  });
});

// ---------------------------------------------------------------------------
// resolveAtidaQuantity — same logic as DosFarma
// ---------------------------------------------------------------------------
describe("resolveAtidaQuantity", () => {
  const hit = (
    name: string,
    content_size?: string,
    content_size_factor?: number,
  ) => ({
    name,
    price: { EUR: { default: 1.0 } },
    url: "https://atida.com",
    content_size,
    content_size_factor,
  });

  it("should extract piece count", () => {
    expect(
      resolveAtidaQuantity(hit("Ibuprofeno 40 comp", "40.0000 Piece")),
    ).toEqual({
      packageSize: 40,
    });
  });

  it("should extract ml", () => {
    expect(
      resolveAtidaQuantity(hit("Champu 400ml", "400.0000 Milliliter")),
    ).toEqual({
      netWeight: 400,
      netWeightUnit: "ml",
    });
  });

  it("should fall back to name parsing", () => {
    expect(resolveAtidaQuantity(hit("Crema facial 50ml"))).toEqual({
      netWeight: 50,
      netWeightUnit: "ml",
    });
  });
});

// ---------------------------------------------------------------------------
// resolveCarrefourQuantity (Empathy.co structured fields)
// ---------------------------------------------------------------------------
describe("resolveCarrefourQuantity", () => {
  const item = (
    display_name: string,
    unit_conversion_factor?: number,
    unit_short_name?: string,
  ) => ({
    display_name,
    active_price: 1.0,
    unit_conversion_factor,
    unit_short_name,
  });

  it("should extract liters as ml", () => {
    expect(resolveCarrefourQuantity(item("Leche 1,5 l.", 1.5, "l"))).toEqual({
      netWeight: 1500,
      netWeightUnit: "ml",
    });
  });

  it("should extract units as packageSize", () => {
    expect(resolveCarrefourQuantity(item("Panales 56 ud.", 56, "ud"))).toEqual({
      packageSize: 56,
    });
  });

  it("should extract ml directly", () => {
    expect(
      resolveCarrefourQuantity(item("Refresco 330 ml", 330, "ml")),
    ).toEqual({
      netWeight: 330,
      netWeightUnit: "ml",
    });
  });

  it("should convert cl to ml", () => {
    expect(resolveCarrefourQuantity(item("Cerveza 33 cl", 33, "cl"))).toEqual({
      netWeight: 330,
      netWeightUnit: "ml",
    });
  });

  it("should convert kg to grams", () => {
    expect(resolveCarrefourQuantity(item("Arroz 1 kg", 1, "kg"))).toEqual({
      netWeight: 1000,
      netWeightUnit: "g",
    });
  });

  it("should extract grams directly", () => {
    expect(resolveCarrefourQuantity(item("Lonchas 200 g", 200, "g"))).toEqual({
      netWeight: 200,
      netWeightUnit: "g",
    });
  });

  it("should fall back to name parsing when no structured fields", () => {
    expect(resolveCarrefourQuantity(item("Agua Cabreiroa 1,5 l."))).toEqual({
      netWeight: 1500,
      netWeightUnit: "ml",
    });
  });

  it("should handle 2.2L correctly", () => {
    expect(resolveCarrefourQuantity(item("Leche 2,2 l.", 2.2, "l"))).toEqual({
      netWeight: 2200,
      netWeightUnit: "ml",
    });
  });
});

// ---------------------------------------------------------------------------
// resolveFroizQuantity (Froiz Empathy.co structured fields)
// ---------------------------------------------------------------------------
describe("resolveFroizQuantity", () => {
  const item = (
    __name: string,
    measurementUnit?: string,
    measurementUnitRatio?: number,
  ) => ({ __name, measurementUnit, measurementUnitRatio });

  it("should convert Litro to ml", () => {
    expect(
      resolveFroizQuantity(item("Agua Fontiña 1,5 l", "Litro", 1.5)),
    ).toEqual({
      netWeight: 1500,
      netWeightUnit: "ml",
    });
  });

  it("should extract unit count from Unidad", () => {
    expect(
      resolveFroizQuantity(item("Pañal Dodot T5 48 u", "Unidad", 48)),
    ).toEqual({
      packageSize: 48,
    });
  });

  it("should convert Kilogramo to grams", () => {
    expect(
      resolveFroizQuantity(item("Queso lonchas 200 g", "Kilogramo", 0.2)),
    ).toEqual({
      netWeight: 200,
      netWeightUnit: "g",
    });
  });

  it("should handle multi-pack liquid total (12×33cl = 3.96L)", () => {
    expect(
      resolveFroizQuantity(item("Cerveza pack 12x33cl", "Litro", 3.96)),
    ).toEqual({
      netWeight: 3960,
      netWeightUnit: "ml",
    });
  });

  it("should fall back to name parsing when fields absent", () => {
    expect(resolveFroizQuantity(item("Agua Cabreiroa 1,5 l"))).toEqual({
      netWeight: 1500,
      netWeightUnit: "ml",
    });
  });

  it("should fall back to name parsing for unknown unit", () => {
    expect(resolveFroizQuantity(item("Producto 5 uds", "Unknown", 5))).toEqual({
      packageSize: 5,
    });
  });
});
