import { z } from 'zod';
import { AssistanceStatus, OrderStatus } from '../../../generated/prisma/index.js';

export const dashboardQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  tableId: z.string().cuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(80).optional(),
});
export const assistanceStatusSchema = z.object({ status: z.nativeEnum(AssistanceStatus) });
