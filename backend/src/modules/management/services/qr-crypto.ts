import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../../config/env.js';

const key = createHash('sha256').update(env.QR_TOKEN_ENCRYPTION_KEY).digest();
export const encryptQrToken = (token: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
};
export const decryptQrToken = (value: string) => {
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length < 29) throw new Error('Invalid encrypted QR token');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
};
