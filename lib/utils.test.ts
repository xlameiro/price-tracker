import {
  cn,
  formatCurrency,
  formatDate,
  getImageSrc,
  truncate,
} from "@/lib/utils";
import { describe, expect, it } from "vitest";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("resolves tailwind conflicts — last class wins", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("supports conditional classes", () => {
    const active = true;
    const disabled = false;
    expect(cn("base", active && "active", disabled && "disabled")).toBe(
      "base active",
    );
  });
});

describe("formatDate", () => {
  it("formats a Date object to a locale string", () => {
    const date = new Date("2024-06-15T00:00:00.000Z");
    const result = formatDate(
      date,
      { year: "numeric", month: "long", day: "numeric" },
      "en-US",
    );
    expect(result).toContain("2024");
    expect(result).toContain("15");
  });

  it("accepts a date string", () => {
    const result = formatDate("2024-01-01", { year: "numeric" }, "en-US");
    expect(result).toBe("2024");
  });

  it("accepts a numeric timestamp", () => {
    const timestamp = new Date("2024-03-07").getTime();
    const result = formatDate(timestamp, { year: "numeric" }, "en-US");
    expect(result).toBe("2024");
  });
});

describe("formatCurrency", () => {
  it("formats a number as USD by default", () => {
    const result = formatCurrency(1234.56);
    expect(result).toBe("$1,234.56");
  });

  it("formats with a different currency", () => {
    const result = formatCurrency(99.99, "EUR", "de-DE");
    expect(result).toContain("99,99");
    expect(result).toContain("€");
  });

  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("truncate", () => {
  it("returns the original string when within max length", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates and appends ellipsis when over max length", () => {
    const result = truncate("hello world", 8);
    expect(result).toHaveLength(8);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns the original string when exactly at max length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("handles empty strings", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("getImageSrc", () => {
  it("should mark static.carrefour.es as unoptimized for direct browser fetch", () => {
    const url =
      "https://static.carrefour.es/hd_350x_/img_pim_food/538634_00_1.jpg";
    const { src, unoptimized } = getImageSrc(url);
    expect(src).toBe(url);
    expect(unoptimized).toBe(true);
  });

  it("should pass Amazon images through Next.js optimization", () => {
    const url =
      "https://m.media-amazon.com/images/I/71GZPE5IbBL._AC_UL320_.jpg";
    const { src, unoptimized } = getImageSrc(url);
    expect(src).toBe(url);
    expect(unoptimized).toBe(false);
  });

  it("should pass arbitrary external URLs through Next.js optimization", () => {
    const url = "https://cdn.example.com/product.jpg";
    const { src, unoptimized } = getImageSrc(url);
    expect(src).toBe(url);
    expect(unoptimized).toBe(false);
  });

  it("should handle invalid URLs without throwing", () => {
    const { src, unoptimized } = getImageSrc("not-a-url");
    expect(src).toBe("not-a-url");
    expect(unoptimized).toBe(false);
  });
});
