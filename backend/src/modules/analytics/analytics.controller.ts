import type { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import { analyticsRepository } from './analytics.repository.js';
import { analyticsQuerySchema } from './analytics.validator.js';

export const report: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!req.tenant) throw new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required');
  const input = analyticsQuerySchema.parse(req.query);
  const branchId = req.tenant.branchId ?? input.branchId ?? null;
  if (req.tenant.branchId && input.branchId && req.tenant.branchId !== input.branchId) throw new AppError(403, 'BRANCH_FORBIDDEN', 'You cannot view another branch report');
  res.json(await analyticsRepository.report(req.tenant.restaurantId, branchId, new Date(input.from), new Date(input.to)));
};
