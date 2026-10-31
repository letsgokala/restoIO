import type { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import { cashierService } from './cashier.service.js';
import { recordPaymentSchema, sessionIdSchema, voidPaymentSchema } from './cashier.validator.js';

const context = (req: Parameters<RequestHandler>[0]) => {
  if (!req.tenant || !req.auth) throw new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required');
  return { restaurantId: req.tenant.restaurantId, branchId: req.tenant.branchId, userId: req.auth.user.id };
};
export const sessions: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const c = context(req); res.json(await cashierService.listSessions(c.restaurantId, c.branchId)); };
export const session: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const c = context(req); res.json(await cashierService.getSession(sessionIdSchema.parse(req.params.sessionId), c.restaurantId, c.branchId)); };
export const recordPayment: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const c = context(req); res.status(201).json(await cashierService.recordPayment(sessionIdSchema.parse(req.params.sessionId), c.restaurantId, c.branchId, c.userId, recordPaymentSchema.parse(req.body))); };
export const closeSession: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const c = context(req); res.json(await cashierService.closeSession(sessionIdSchema.parse(req.params.sessionId), c.restaurantId, c.branchId, c.userId)); };
export const voidPayment: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const c = context(req); res.json(await cashierService.voidPayment(sessionIdSchema.parse(req.params.paymentId), c.restaurantId, c.branchId, c.userId, voidPaymentSchema.parse(req.body).reason)); };
export const refundPayment: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const c = context(req); res.json(await cashierService.refundPayment(sessionIdSchema.parse(req.params.paymentId), c.restaurantId, c.branchId, c.userId, voidPaymentSchema.parse(req.body).reason)); };
