import { Router } from 'express';
import { authenticate, requireTenant } from '../../middleware/authenticate.js';
import { requireTenantRoles } from '../../middleware/authorize-role.js';
import { report } from './analytics.controller.js';

export const analyticsRouter = Router();
analyticsRouter.get('/tenant/analytics', authenticate, requireTenant, requireTenantRoles('RESTAURANT_OWNER', 'MANAGER'), report);
