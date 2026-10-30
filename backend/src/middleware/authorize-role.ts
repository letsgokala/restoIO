import type { RequestHandler } from 'express';
import type { UserRole } from '../generated/prisma/index.js';
import { AppError } from '../shared/errors/app-error.js';
export const requireRoles = (...allowedRoles: UserRole[]): RequestHandler => (req, _res, next) => {
  if (!req.auth || !req.tenant) return next(new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required'));
  if (req.auth.user.isPlatformAdmin || allowedRoles.includes(req.tenant.role)) return next();
  next(new AppError(403, 'ROLE_FORBIDDEN', 'Your role cannot perform this action'));
};
export const requireTenantRoles = (...allowedRoles: UserRole[]): RequestHandler => (req, _res, next) => {
  if (!req.auth || !req.tenant) return next(new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required'));
  if (!req.auth.user.isPlatformAdmin && allowedRoles.includes(req.tenant.role)) return next();
  next(new AppError(403, 'ROLE_FORBIDDEN', 'Your restaurant role cannot perform this action'));
};
export const requirePlatformAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue'));
  if (!req.auth.user.isPlatformAdmin) return next(new AppError(403, 'PLATFORM_ADMIN_REQUIRED', 'Platform administrator access is required'));
  next();
};
export const requireRestaurantWideAccess: RequestHandler = (req, _res, next) => {
  if (!req.auth || !req.tenant) return next(new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required'));
  if (req.auth.user.isPlatformAdmin || req.tenant.role === 'RESTAURANT_OWNER' || (req.tenant.role === 'MANAGER' && req.tenant.branchId === null)) return next();
  next(new AppError(403, 'RESTAURANT_WIDE_ACCESS_REQUIRED', 'This action needs restaurant-wide access'));
};
export const requireWaiter: RequestHandler = (req, _res, next) => {
  if (!req.auth || !req.tenant) return next(new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required'));
  if (!req.auth.user.isPlatformAdmin && req.tenant.role === 'WAITER') return next();
  next(new AppError(403, 'WAITER_REQUIRED', 'This dashboard is available to waiter accounts only'));
};
export const requireKitchen: RequestHandler = (req, _res, next) => {
  if (!req.auth || !req.tenant) return next(new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required'));
  if (!req.auth.user.isPlatformAdmin && req.tenant.role === 'KITCHEN' && req.tenant.branchId) return next();
  if (req.tenant.role === 'KITCHEN' && !req.tenant.branchId) return next(new AppError(403, 'KITCHEN_BRANCH_REQUIRED', 'Kitchen access must be scoped to an assigned branch'));
  next(new AppError(403, 'KITCHEN_REQUIRED', 'This workspace is available to kitchen accounts only'));
};
