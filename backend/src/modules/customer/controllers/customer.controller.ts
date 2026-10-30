import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AssistanceKind, OrderStatus } from '../../../generated/prisma/index.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { customerService } from '../customer.service.js';
import { waiterService } from '../../waiter/services/waiter.service.js';

const qrPath = z.string().min(32).max(160);
const locale = z.enum(['am', 'en', 'ar', 'zh', 'tr', 'es', 'de']).default('en');
const orderSchema = z.object({ note: z.string().trim().max(500).optional(), items: z.array(z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(1).max(20), modifiers: z.array(z.object({ groupId: z.string().uuid(), optionIds: z.array(z.string().uuid()).max(12) })).max(20), instructions: z.string().trim().max(300).optional() })).min(1).max(40) });
const guestToken = (req: Parameters<RequestHandler>[0]) => { const v = req.get('x-guest-order-token'); if (!v || !/^[A-Za-z0-9_-]{40,100}$/.test(v)) throw new AppError(401, 'GUEST_ACCESS_REQUIRED', 'Guest order access is required'); return v; };

export const resolveCustomerQr: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(await customerService.resolveQr(qrPath.parse(req.params.token))); };
export const getCustomerMenu: RequestHandler = async (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json(await customerService.getMenu(qrPath.parse(req.params.token), locale.parse(req.query.locale))); };
export const submitCustomerOrder: RequestHandler = async (req, res) => {
  const token = guestToken(req); const key = req.get('idempotency-key');
  if (!key || !/^[A-Za-z0-9_-]{16,100}$/.test(key)) throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required');
  const result = await customerService.placeOrder(qrPath.parse(req.params.token), key, token, orderSchema.parse(req.body));
  res.cookie(`guest_order_${result.order.reference}`, result.accessToken, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', path: `/api/v1/customer/orders/${result.order.reference}`, expires: result.expiresAt });
  res.status(201).json(result.order);
};
export const getGuestOrder: RequestHandler = async (req, res) => {
  const reference = z.string().regex(/^R-[A-F0-9]{16}$/).parse(req.params.reference); const token = req.cookies?.[`guest_order_${reference}`] as string | undefined;
  if (!token) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
  res.setHeader('Cache-Control', 'no-store'); res.json(await customerService.trackOrder(reference, token));
};
export const createAssistanceRequest: RequestHandler = async (req, res) => {
  const kind = z.nativeEnum(AssistanceKind).parse(req.body?.kind);
  const result = await customerService.requestAssistance(qrPath.parse(req.params.token), kind);
  res.cookie(`guest_assistance_${result.reference}`, result.accessToken, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict', path: `/api/v1/customer/assistance/${result.reference}`, expires: result.expiresAt });
  res.status(201).json({ accepted: result.accepted, reference: result.reference, status: result.status });
};
export const getGuestAssistance: RequestHandler = async (req, res) => {
  const reference = z.string().uuid().parse(req.params.reference);
  const token = req.cookies?.[`guest_assistance_${reference}`] as string | undefined;
  if (!token) throw new AppError(404, 'ASSISTANCE_NOT_FOUND', 'Assistance request not found');
  res.setHeader('Cache-Control', 'no-store');
  res.json(await customerService.trackAssistance(reference, token));
};
export const updateCustomerOrderStatus: RequestHandler = async (req, res) => { const reference = z.string().regex(/^R-[A-F0-9]{16}$/).parse(req.params.reference); const body = z.object({ status: z.nativeEnum(OrderStatus), reason: z.string().trim().max(500).optional() }).parse(req.body); res.setHeader('Cache-Control', 'no-store'); const t = req.tenant!; res.json(await waiterService.transitionOrder(reference, body.status, t.restaurantId, t.branchId, t.role, req.auth!.user.id, body.reason)); };
