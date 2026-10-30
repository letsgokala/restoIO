import type { RequestHandler } from 'express';
import { env } from '../../../config/env.js';
import { authService } from '../services/auth-factory.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { managementService } from '../../management/services/management.service.js';
const cookieOptions = { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/v1', maxAge: env.SESSION_TTL_HOURS * 3600000 };
export const registerRestaurant: RequestHandler = async (req, res) => {
  const created = await managementService.createRestaurant(req.body);
  res.status(201).json({ restaurant: { id: created.restaurant.id, name: created.restaurant.name, slug: created.restaurant.slug }, branch: { id: created.branch.id, name: created.branch.name }, owner: created.owner });
};
export const login: RequestHandler = async (req, res) => { const result = await authService.login(req.body); res.cookie(env.SESSION_COOKIE_NAME, result.token, cookieOptions); res.status(200).json(result.body); };
export const me: RequestHandler = (req, res) => { if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue'); res.json({ user: req.auth.user, restaurantId: req.auth.restaurantId }); };
export const logout: RequestHandler = async (req, res) => { const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined; if (token) await authService.logout(token); res.clearCookie(env.SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: undefined }); res.status(204).end(); };
