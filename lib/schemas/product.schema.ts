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

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
