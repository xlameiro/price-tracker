import type { StoreSlug } from "@/lib/constants";
import { AmazonScraper } from "./amazon";
import { CarrefourScraper } from "./carrefour";
import { ElCorteInglesScraper } from "./elcorteingles";
import { PcComponentesScraper } from "./pccomponentes";
import type { PriceScraper } from "./types";

const scrapers = new Map<StoreSlug, PriceScraper>([
  ["amazon-es", new AmazonScraper()],
  ["carrefour", new CarrefourScraper()],
  ["elcorteingles", new ElCorteInglesScraper()],
  ["pccomponentes", new PcComponentesScraper()],
] as Array<[StoreSlug, PriceScraper]>);

export function getScraperBySlug(slug: StoreSlug): PriceScraper | null {
  return scrapers.get(slug) ?? null;
}

export { type PriceScraper, type ScrapedPrice } from "./types";
