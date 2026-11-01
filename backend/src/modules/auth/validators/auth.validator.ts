import { z } from 'zod';
export const loginSchema = z.object({ email: z.string().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(1).max(128), restaurantId: z.string().optional() }).strict();
export const bootstrapPlatformAdminSchema = z.object({ token: z.string().min(32).max(512), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), displayName: z.string().trim().min(2).max(120), password: z.string().min(12).max(128) }).strict();
