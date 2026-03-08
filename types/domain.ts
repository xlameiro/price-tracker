import type { PriceSource, StoreType } from "@prisma/client";
import type { PaginatedResponse, PaginationMeta } from "./index";

// Re-export useful Prisma enums for convenience
export type { PriceSource, StoreType };

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
  scrapedAt: string;
  store: StoreDto;
}

export interface ProductWithPricesDto extends ProductDto {
  latestPrices: PriceEntryDto[];
  lowestPrice: PriceEntryDto | null;
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

// ─────────────────────────────────────────
// Paginated response types
// ─────────────────────────────────────────

export type PaginatedProducts = PaginatedResponse<ProductDto>;
export type PaginatedTracked = PaginatedResponse<TrackedProductDto>;
export type PaginatedAlerts = PaginatedResponse<PriceAlertDto>;

export type { PaginationMeta };
