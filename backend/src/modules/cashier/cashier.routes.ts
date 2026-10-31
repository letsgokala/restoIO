import { Router } from 'express';
import { authenticate, requireTenant } from '../../middleware/authenticate.js';
import { requireTenantRoles } from '../../middleware/authorize-role.js';
import * as controller from './cashier.controller.js';

export const cashierRouter = Router();
cashierRouter.use('/tenant/cashier', authenticate, requireTenant, requireTenantRoles('CASHIER', 'RESTAURANT_OWNER', 'MANAGER'));
cashierRouter.get('/tenant/cashier/sessions', controller.sessions);
cashierRouter.get('/tenant/cashier/sessions/:sessionId', controller.session);
cashierRouter.post('/tenant/cashier/sessions/:sessionId/payments', controller.recordPayment);
cashierRouter.post('/tenant/cashier/sessions/:sessionId/close', controller.closeSession);
cashierRouter.post('/tenant/cashier/payments/:paymentId/void', requireTenantRoles('RESTAURANT_OWNER', 'MANAGER'), controller.voidPayment);
cashierRouter.post('/tenant/cashier/payments/:paymentId/refund', requireTenantRoles('RESTAURANT_OWNER', 'MANAGER'), controller.refundPayment);
