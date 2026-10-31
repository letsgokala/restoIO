import { AppError } from '../../../shared/errors/app-error.js';
import { kitchenRepository } from '../repositories/kitchen.repository.js';

type TenantScope = { restaurantId: string; branchId: string | null; staffUserId: string };
const kitchenOrder = (order: NonNullable<Awaited<ReturnType<typeof kitchenRepository.startOrder>>>) => ({
  reference: order.reference,
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  branch: order.branch,
  table: order.table,
  items: order.items.map((item) => ({
    id: item.id,
    name: item.nameSnapshot,
    quantity: item.quantity,
    customizations: item.customizations,
    specialInstructions: item.specialInstructions,
    status: item.kitchenStatus,
    preparationStartedAt: item.preparationStartedAt,
    readyAt: item.readyAt,
    events: item.preparationEvents,
  })),
});

export class KitchenService {
  async getQueue(restaurantId: string, branchId: string | null) {
    const [orders, changes] = await kitchenRepository.queue(restaurantId, branchId);
    return {
      orders: orders.map(kitchenOrder),
      changes: changes.map((order) => ({ reference: order.reference, table: order.table, changedAt: order.events[0]?.createdAt ?? order.updatedAt, note: order.events[0]?.note ?? 'Order cancelled by restaurant staff' })),
      generatedAt: new Date().toISOString(),
    };
  }

  async startOrder(reference: string, scope: TenantScope) {
    try {
      const order = await kitchenRepository.startOrder(reference, scope.restaurantId, scope.branchId, scope.staffUserId);
      if (!order) throw new AppError(409, 'INVALID_KITCHEN_TRANSITION', 'Only a confirmed order can be started; refresh the kitchen queue');
      return kitchenOrder(order);
    } catch (error) {
      if (error instanceof Error && error.message === 'ORDER_HAS_NO_ITEMS') throw new AppError(409, 'ORDER_HAS_NO_ITEMS', 'An empty order cannot be prepared');
      throw error;
    }
  }

  async markItemReady(reference: string, itemId: string, scope: TenantScope) {
    const result = await kitchenRepository.markItemReady(reference, itemId, scope.restaurantId, scope.branchId, scope.staffUserId);
    if (result.kind === 'NOT_FOUND') throw new AppError(404, 'KITCHEN_TICKET_NOT_FOUND', 'Kitchen ticket or item not found');
    if (result.kind === 'INVALID_ORDER_STATE') throw new AppError(409, 'INVALID_KITCHEN_TRANSITION', 'Start preparing this order before marking its items ready');
    if (result.kind === 'INVALID_ITEM_STATE') throw new AppError(409, 'INVALID_ITEM_TRANSITION', 'This item is not currently being prepared');
    return kitchenOrder(result.order);
  }

  async markRemainingReady(reference: string, scope: TenantScope) {
    const result = await kitchenRepository.markRemainingReady(reference, scope.restaurantId, scope.branchId, scope.staffUserId);
    if (result.kind === 'NOT_FOUND') throw new AppError(404, 'KITCHEN_TICKET_NOT_FOUND', 'Kitchen ticket not found');
    if (result.kind === 'INVALID_ORDER_STATE') throw new AppError(409, 'INVALID_KITCHEN_TRANSITION', 'Start preparing this order before marking its items ready');
    if (result.kind === 'INVALID_ITEM_STATE') throw new AppError(409, 'NO_ITEMS_REMAINING', 'There are no unfinished items on this ticket');
    return kitchenOrder(result.order);
  }
}

export const kitchenService = new KitchenService();
