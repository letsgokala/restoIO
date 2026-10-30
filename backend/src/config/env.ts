import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().default('postgresql://restoio:restoio_dev@localhost:5432/restoio?schema=public'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  SESSION_COOKIE_NAME: z.string().min(1).default('restoio_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(12),
  QR_TOKEN_ENCRYPTION_KEY: z.string().min(32).default('restoio-local-qr-encryption-key-32'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@demo.local'),
  SEED_ADMIN_PASSWORD: z.string().min(12).default('ChangeMe_OnlyForLocalDev_123!'),
});
export const env = envSchema.parse(process.env);
if (env.NODE_ENV === 'production') {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured in production');
  if (!process.env.WEB_ORIGIN || new URL(env.WEB_ORIGIN).protocol !== 'https:') throw new Error('WEB_ORIGIN must be an HTTPS origin in production');
  if (!process.env.QR_TOKEN_ENCRYPTION_KEY || Buffer.byteLength(env.QR_TOKEN_ENCRYPTION_KEY) < 32) throw new Error('QR_TOKEN_ENCRYPTION_KEY must be configured with at least 32 bytes in production');
}
