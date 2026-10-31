import { Router } from 'express';
import { authenticate, requireTenant } from '../../middleware/authenticate.js';
import { requireKitchen } from '../../middleware/authorize-role.js';
import * as controller from './controllers/kitchen.controller.js';

export const kitchenRouter = Router();
kitchenRouter.use('/tenant/kitchen', authenticate, requireTenant, requireKitchen);
kitchenRouter.get('/tenant/kitchen/queue', controller.queue);
kitchenRouter.patch('/tenant/kitchen/orders/:reference/start', controller.startOrder);
kitchenRouter.patch('/tenant/kitchen/orders/:reference/items/:itemId/ready', controller.markItemReady);
kitchenRouter.patch('/tenant/kitchen/orders/:reference/ready-remaining', controller.markRemainingReady);
