export interface ScrapedPrice {
  price: number;
  currency: string;
  url: string;
  isAvailable: boolean;
}

export interface PriceScraper {
  storeSlug: string;
  scrape(productUrl: string): Promise<ScrapedPrice | null>;
}
