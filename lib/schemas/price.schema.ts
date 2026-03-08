import { z } from "zod";

const PriceSourceEnum = z.enum(["API", "SCRAPE", "MANUAL"]);

export const CreatePriceEntrySchema = z.object({
  productId: z.cuid(),
  storeId: z.cuid(),
  price: z.number().positive().multipleOf(0.01),
  currency: z.string().length(3).default("EUR"),
  url: z.url().optional(),
  source: PriceSourceEnum.default("MANUAL"),
  isAvailable: z.boolean().default(true),
});

export const PriceHistoryQuerySchema = z.object({
  storeId: z.cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(365).default(90),
});

export type CreatePriceEntryInput = z.infer<typeof CreatePriceEntrySchema>;
export type PriceHistoryQuery = z.infer<typeof PriceHistoryQuerySchema>;
