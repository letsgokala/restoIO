import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { authService } from '../modules/auth/services/auth-factory.js';
import { AppError } from '../shared/errors/app-error.js';
export const authenticate: RequestHandler = async (req, _res, next) => { const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined; if (!token) return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue')); req.auth = await authService.authenticate(token); next(); };
export const requireTenant: RequestHandler = async (req, _res, next) => { if (!req.auth) return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue')); const restaurantId = req.get('x-restaurant-id'); if (!restaurantId) return next(new AppError(400, 'TENANT_REQUIRED', 'X-Restaurant-Id header is required')); const branchId = req.get('x-branch-id') || undefined; req.tenant = await authService.authorizeTenant(req.auth.user.id, req.auth.user.isPlatformAdmin, restaurantId, branchId); next(); };
