import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../../../shared/errors/app-error.js';
import { waiterService } from '../services/waiter.service.js';
import { assistanceStatusSchema, dashboardQuerySchema } from '../validators/waiter.validator.js';

const id = z.string().cuid();
const tenant = (req: Parameters<RequestHandler>[0]) => { if (!req.tenant) throw new AppError(401, 'TENANT_CONTEXT_REQUIRED', 'Authenticated tenant context is required'); return req.tenant; };
export const dashboard: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const t = tenant(req); res.json(await waiterService.getDashboard(t.restaurantId, t.branchId, dashboardQuerySchema.parse(req.query))); };
export const updateAssistance: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); const t = tenant(req); const body = assistanceStatusSchema.parse(req.body); res.json(await waiterService.updateAssistance(id.parse(req.params.requestId), body.status, t.restaurantId, t.branchId, req.auth!.user.id, t.role)); };
