import { z } from 'zod';
export const userRoleSchema = z.enum(['PLATFORM_ADMIN', 'RESTAURANT_OWNER', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER']);
export type UserRole = z.infer<typeof userRoleSchema>;
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional(), details: z.unknown().optional() }) });
export const healthResponseSchema = z.object({ status: z.literal('ok'), service: z.literal('restoio-api'), timestamp: z.string() });
export type HealthResponse = z.infer<typeof healthResponseSchema>;
