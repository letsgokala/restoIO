import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import { authService } from '../services/auth-factory.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { managementService } from '../../management/services/management.service.js';
import { bootstrapPlatformAdminSchema } from '../validators/auth.validator.js';
import { adminNotificationService } from '../services/admin-notification.service.js';
const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1', maxAge: env.SESSION_TTL_HOURS * 3600000 };
export const registerRestaurant: RequestHandler = async (req, res) => {
  const created = await managementService.requestRestaurant(req.body);
  res.status(201).json({ restaurant: { id: created.restaurant.id, name: created.restaurant.name, slug: created.restaurant.slug }, branch: { id: created.branch.id, name: created.branch.name }, owner: created.owner });
};
export const bootstrapPlatformAdmin: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const input = bootstrapPlatformAdminSchema.parse(req.body);
  const expected = env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN ? Buffer.from(env.PLATFORM_ADMIN_BOOTSTRAP_TOKEN) : Buffer.alloc(0);
  const provided = Buffer.from(input.token);
  if (!expected.length || expected.length !== provided.length || !timingSafeEqual(expected, provided)) throw new AppError(404, 'BOOTSTRAP_UNAVAILABLE', 'Platform administrator setup is unavailable');
  await authService.bootstrapPlatformAdmin({ email: input.email, displayName: input.displayName, password: input.password });
  let notificationSent = false;
  try { notificationSent = await adminNotificationService.sendCreatedConfirmation({ email: input.email, displayName: input.displayName, loginUrl: env.WEB_ORIGIN + '/login' }); }
  catch (error) { console.error(JSON.stringify({ level: 'error', event: 'platform_admin_notification_failed', requestId: req.requestId, message: error instanceof Error ? error.message : 'Email delivery failed' })); }
  res.status(201).json({ created: true, notificationSent, message: notificationSent ? 'Platform administrator created and confirmation email sent.' : 'Platform administrator created. Email delivery is not configured; sign in to continue.' });
};
export const login: RequestHandler = async (req, res) => { const result = await authService.login(req.body); res.cookie(env.SESSION_COOKIE_NAME, result.token, cookieOptions); res.status(200).json(result.body); };
export const me: RequestHandler = (req, res) => { if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue'); res.json({ user: req.auth.user, restaurantId: req.auth.restaurantId }); };
export const logout: RequestHandler = async (req, res) => { const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined; if (token) await authService.logout(token); res.clearCookie(env.SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: undefined }); res.status(204).end(); };
