import { z } from 'zod';

export const sessionIdSchema = z.string().cuid();
export const recordPaymentSchema = z.object({
  amount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
  method: z.enum(['CASH', 'PAY_AT_COUNTER', 'PAY_WAITER', 'OTHER']),
  idempotencyKey: z.string().uuid(),
  transactionReference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});
export const voidPaymentSchema = z.object({ reason: z.string().trim().min(5).max(500) });
