import type { PriceSource, ScrapeStatus, StoreType } from "@prisma/client";
import type { PaginatedResponse, PaginationMeta } from "./index";

// Re-export useful Prisma enums for convenience
export type { PriceSource, ScrapeStatus, StoreType };

// ─────────────────────────────────────────
// Domain types (safe to pass to client)
// ─────────────────────────────────────────

export interface StoreDto {
  id: string;
  name: string;
  slug: string;
  type: StoreType;
  websiteUrl: string;
  logoUrl: string | null;
  freeShippingThreshold: number | null;
  shippingNote: string | null;
}

export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  brand: string | null;
  ean: string | null;
}

export interface PriceEntryDto {
  id: string;
  productId: string;
  storeId: string;
  price: number;
  currency: string;
  url: string | null;
  source: PriceSource;
  isAvailable: boolean;
  /** Number of units in the pack (e.g. 44 diapers) */
  packageSize: number | null;
  /** Shipping cost —0 means free, null means unknown */
  shippingCost: number | null;
  /** Computed: price / packageSize — null when packageSize is unknown */
  unitPrice: number | null;
  scrapedAt: string;
  store: StoreDto;
}

export interface ProductWithPricesDto extends ProductDto {
  latestPrices: PriceEntryDto[];
  lowestPrice: PriceEntryDto | null;
  /** Lowest unit price across all stores with packageSize data */
  lowestUnitPrice: PriceEntryDto | null;
}

export interface TrackedProductDto {
  id: string;
  productId: string;
  createdAt: string;
  product: ProductWithPricesDto;
}

export interface PriceAlertDto {
  id: string;
  productId: string;
  targetPrice: number;
  isActive: boolean;
  triggeredAt: string | null;
  createdAt: string;
  product: ProductDto;
}

export interface ScrapeRunDto {
  id: string;
  storeId: string;
  startedAt: string;
  finishedAt: string | null;
  status: ScrapeStatus;
  productsScraped: number;
  errorMessage: string | null;
  store: StoreDto;
}

// ─────────────────────────────────────────
// Paginated response types
// ─────────────────────────────────────────

export type PaginatedProducts = PaginatedResponse<ProductDto>;
export type PaginatedTracked = PaginatedResponse<TrackedProductDto>;
export type PaginatedAlerts = PaginatedResponse<PriceAlertDto>;

export type { PaginationMeta };
