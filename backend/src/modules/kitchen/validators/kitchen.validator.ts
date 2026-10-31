import { z } from 'zod';

export const orderReferenceSchema = z.string().regex(/^R-[A-F0-9]{16}$/);
export const itemIdSchema = z.string().cuid();
export const readyItemParamsSchema = z.object({ reference: orderReferenceSchema, itemId: itemIdSchema });
