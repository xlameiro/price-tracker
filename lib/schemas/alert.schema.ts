import { z } from "zod";

export const CreateAlertSchema = z.object({
  productId: z.cuid(),
  targetPrice: z.number().positive().multipleOf(0.01),
});

export const UpdateAlertSchema = z.object({
  targetPrice: z.number().positive().multipleOf(0.01).optional(),
  isActive: z.boolean().optional(),
});

export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
export type UpdateAlertInput = z.infer<typeof UpdateAlertSchema>;
