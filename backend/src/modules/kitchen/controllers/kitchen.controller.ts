import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../shared/errors/app-error.js';
import { kitchenService } from '../services/kitchen.service.js';
import { orderReferenceSchema, readyItemParamsSchema } from '../validators/kitchen.validator.js';

const tenant = (req: Parameters<RequestHandler>[0]) => {
  if (!req.tenant || !req.auth) throw new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated kitchen context is required');
  return { restaurantId: req.tenant.restaurantId, branchId: req.tenant.branchId, staffUserId: req.auth.user.id };
};

export const queue: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const scope = tenant(req);
  res.json(await kitchenService.getQueue(scope.restaurantId, scope.branchId));
};

export const startOrder: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await kitchenService.startOrder(orderReferenceSchema.parse(req.params.reference), tenant(req)));
};

export const markItemReady: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const params = readyItemParamsSchema.parse(req.params);
  res.json(await kitchenService.markItemReady(params.reference, params.itemId, tenant(req)));
};

export const markRemainingReady: RequestHandler = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await kitchenService.markRemainingReady(orderReferenceSchema.parse(req.params.reference), tenant(req)));
};
