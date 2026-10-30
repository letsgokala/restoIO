import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, requireTenant } from '../../middleware/authenticate.js';
import { requireRoles } from '../../middleware/authorize-role.js';
import { resolveCustomerQr, getCustomerMenu, submitCustomerOrder, getGuestOrder, createAssistanceRequest, getGuestAssistance, updateCustomerOrderStatus } from './controllers/customer.controller.js';

export const customerRouter = Router();
const publicLimiter = rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });
const assistanceLimiter = rateLimit({ windowMs: 60_000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false });
customerRouter.get('/customer/qr/:token', publicLimiter, resolveCustomerQr);
customerRouter.get('/customer/qr/:token/menu', publicLimiter, getCustomerMenu);
customerRouter.post('/customer/qr/:token/orders', orderLimiter, submitCustomerOrder);
customerRouter.get('/customer/orders/:reference', publicLimiter, getGuestOrder);
customerRouter.post('/customer/qr/:token/assistance', assistanceLimiter, createAssistanceRequest);
customerRouter.get('/customer/assistance/:reference', publicLimiter, getGuestAssistance);
customerRouter.patch('/tenant/orders/:reference/status', authenticate, requireTenant, requireRoles('RESTAURANT_OWNER', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'), updateCustomerOrderStatus);
