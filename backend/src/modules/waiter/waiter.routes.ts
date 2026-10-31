import { Router } from 'express';
import { authenticate, requireTenant } from '../../middleware/authenticate.js';
import { requireWaiter } from '../../middleware/authorize-role.js';
import * as controller from './controllers/waiter.controller.js';

export const waiterRouter = Router();
waiterRouter.use('/tenant/waiter', authenticate, requireTenant, requireWaiter);
waiterRouter.get('/tenant/waiter/dashboard', controller.dashboard);
waiterRouter.patch('/tenant/waiter/assistance/:requestId', controller.updateAssistance);
