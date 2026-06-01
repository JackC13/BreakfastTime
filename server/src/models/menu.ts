import { z } from 'zod';

export const MenuItemSchema = z.object({
  name:         z.string().min(1),
  price:        z.number().positive().nullable(),
  category:     z.string().default('其他'),
  desc:         z.string().nullable().optional(),
  needs_review: z.boolean().default(false),
});

export const ExtractionResultSchema = z.object({
  items:    z.array(MenuItemSchema),
  source:   z.enum(['image', 'website', 'delivery']),
  raw_url:  z.string().optional(),
});

export type MenuItem         = z.infer<typeof MenuItemSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
