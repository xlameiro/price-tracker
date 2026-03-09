import { z } from "zod";

export const CreateProductSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[\w-]+$/, "Only letters, numbers, hyphens and underscores"),
  description: z.string().max(2000).optional(),
  imageUrl: z.url().optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  ean: z
    .string()
    .regex(/^\d{8,13}$/, "EAN must be 8–13 digits")
    .optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().optional(),
  brand: z.string().optional(),
  q: z.string().max(200).optional(),
});

// Schema for tracking a product discovered via search results.
// The client sends the chosen SearchResult data; the server creates/finds
// the Product and PriceEntry, then upserts the TrackedProduct.
// `siblings` carries the other store results from the same search so the
// server can save price entries for all stores in one request.
const SiblingResultSchema = z.object({
  storeSlug: z.string().min(1).max(100),
  price: z.number().positive(),
  currency: z.string().length(3).default("EUR"),
  productUrl: z.url().optional(),
  packageSize: z.number().int().positive().optional(),
  netWeight: z.number().positive().optional(),
  netWeightUnit: z.enum(["g", "ml"]).optional(),
  subscribePrice: z.number().positive().optional(),
});

export const TrackFromSearchSchema = z.object({
  name: z.string().min(2).max(200),
  storeSlug: z.string().min(1).max(100),
  price: z.number().positive(),
  currency: z.string().length(3).default("EUR"),
  imageUrl: z.url().optional(),
  productUrl: z.url().optional(),
  packageSize: z.number().int().positive().optional(),
  netWeight: z.number().positive().optional(),
  netWeightUnit: z.enum(["g", "ml"]).optional(),
  subscribePrice: z.number().positive().optional(),
  ean: z
    .string()
    .regex(/^\d{8,13}$/)
    .optional(),
  siblings: z.array(SiblingResultSchema).max(50).optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
export type TrackFromSearchInput = z.infer<typeof TrackFromSearchSchema>;
