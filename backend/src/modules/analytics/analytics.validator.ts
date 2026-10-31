import { z } from 'zod';
export const analyticsQuerySchema = z.object({ from: z.string().datetime(), to: z.string().datetime(), branchId: z.string().cuid().optional() }).refine((v) => new Date(v.to) > new Date(v.from) && new Date(v.to).getTime() - new Date(v.from).getTime() <= 366 * 86400000, { message: 'Select a range up to 366 days' });
