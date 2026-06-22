import { z } from 'zod';

export const ISODateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const ISODateTimeSchema = z.string().min(10);

export const OverrideRecipeSnapshotSchema = z.object({
  recipeItems: z.array(z.object({
    componentId: z.string(),
    ml: z.number().int().min(0),
    sortOrder: z.number().int().min(0),
    deliveryForm: z.enum(['flasche', 'sondomat', 'spritze']).nullable().optional(),
  })).min(0),
});
