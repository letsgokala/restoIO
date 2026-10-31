import { KitchenItemStatus, OrderStatus, Prisma } from '../../../generated/prisma/index.js';
import { prisma } from '../../../config/prisma.js';

const orderInclude = {
  branch: { select: { name: true } },
  table: { select: { label: true } },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true, nameSnapshot: true, quantity: true, customizations: true, specialInstructions: true,
      kitchenStatus: true, preparationStartedAt: true, readyAt: true,
      preparationEvents: { orderBy: { createdAt: 'asc' as const }, select: { previousStatus: true, status: true, createdAt: true } },
    },
  },
};

export class KitchenRepository {
  queue(restaurantId: string, branchId: string | null) {
    const changesSince = new Date(Date.now() - 30 * 60_000);
    return Promise.all([
      prisma.customerOrder.findMany({
        where: { restaurantId, ...(branchId ? { branchId } : {}), status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] } },
        orderBy: [{ createdAt: 'asc' }], take: 300, include: orderInclude,
      }),
      prisma.customerOrder.findMany({
        where: { restaurantId, ...(branchId ? { branchId } : {}), status: OrderStatus.CANCELLED, updatedAt: { gte: changesSince } },
        orderBy: { updatedAt: 'desc' }, take: 25,
        select: { reference: true, updatedAt: true, table: { select: { label: true } }, events: { orderBy: { createdAt: 'desc' }, take: 1, select: { note: true, createdAt: true } } },
      }),
    ]);
  }

  async startOrder(reference: string, restaurantId: string, branchId: string | null, staffUserId: string) {
    return prisma.$transaction(async (tx) => {
      if (branchId) await tx.$queryRaw`SELECT id FROM "CustomerOrder" WHERE reference = ${reference} AND "restaurantId" = ${restaurantId} AND "branchId" = ${branchId} AND status = 'CONFIRMED'::"OrderStatus" FOR UPDATE`;
      else await tx.$queryRaw`SELECT id FROM "CustomerOrder" WHERE reference = ${reference} AND "restaurantId" = ${restaurantId} AND status = 'CONFIRMED'::"OrderStatus" FOR UPDATE`;
      const order = await tx.customerOrder.findFirst({ where: { reference, restaurantId, ...(branchId ? { branchId } : {}), status: OrderStatus.CONFIRMED }, include: { items: true } });
      if (!order) return null;
      if (!order.items.length) throw new Error('ORDER_HAS_NO_ITEMS');
      const startedAt = new Date();
      const changed = await tx.customerOrder.updateMany({ where: { id: order.id, status: OrderStatus.CONFIRMED }, data: { status: OrderStatus.PREPARING } });
      if (!changed.count) return null;
      await tx.orderEvent.create({ data: { orderId: order.id, previousStatus: OrderStatus.CONFIRMED, status: OrderStatus.PREPARING, staffUserId } });
      const pendingItems = order.items.filter((item) => item.kitchenStatus === KitchenItemStatus.PENDING);
      if (pendingItems.length) {
        await tx.customerOrderItem.updateMany({ where: { id: { in: pendingItems.map((item) => item.id) }, kitchenStatus: KitchenItemStatus.PENDING }, data: { kitchenStatus: KitchenItemStatus.PREPARING, preparationStartedAt: startedAt } });
        await tx.kitchenItemEvent.createMany({ data: pendingItems.map((item) => ({ orderItemId: item.id, previousStatus: KitchenItemStatus.PENDING, status: KitchenItemStatus.PREPARING, staffUserId })) });
      }
      return tx.customerOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async markItemReady(reference: string, itemId: string, restaurantId: string, branchId: string | null, staffUserId: string) {
    return prisma.$transaction(async (tx) => {
      const scopedOrder = await tx.customerOrder.findFirst({ where: { reference, restaurantId, ...(branchId ? { branchId } : {}) }, select: { id: true } });
      if (!scopedOrder) return { kind: 'NOT_FOUND' as const };
      await tx.$queryRaw`SELECT id FROM "CustomerOrder" WHERE id = ${scopedOrder.id} FOR UPDATE`;
      const order = await tx.customerOrder.findUniqueOrThrow({ where: { id: scopedOrder.id }, include: { items: true } });
      if (order.status !== OrderStatus.PREPARING) return { kind: 'INVALID_ORDER_STATE' as const };
      const item = order.items.find((row) => row.id === itemId);
      if (!item) return { kind: 'NOT_FOUND' as const };
      if (item.kitchenStatus !== KitchenItemStatus.PREPARING) return { kind: 'INVALID_ITEM_STATE' as const };
      const readyAt = new Date();
      const changed = await tx.customerOrderItem.updateMany({ where: { id: item.id, orderId: order.id, kitchenStatus: KitchenItemStatus.PREPARING }, data: { kitchenStatus: KitchenItemStatus.READY, readyAt } });
      if (!changed.count) return { kind: 'INVALID_ITEM_STATE' as const };
      await tx.kitchenItemEvent.create({ data: { orderItemId: item.id, previousStatus: KitchenItemStatus.PREPARING, status: KitchenItemStatus.READY, staffUserId } });
      const unfinished = await tx.customerOrderItem.count({ where: { orderId: order.id, kitchenStatus: { not: KitchenItemStatus.READY } } });
      if (unfinished === 0) {
        const orderChanged = await tx.customerOrder.updateMany({ where: { id: order.id, status: OrderStatus.PREPARING }, data: { status: OrderStatus.READY } });
        if (orderChanged.count) await tx.orderEvent.create({ data: { orderId: order.id, previousStatus: OrderStatus.PREPARING, status: OrderStatus.READY, staffUserId } });
      }
      return { kind: 'OK' as const, order: await tx.customerOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async markRemainingReady(reference: string, restaurantId: string, branchId: string | null, staffUserId: string) {
    return prisma.$transaction(async (tx) => {
      const scopedOrder = await tx.customerOrder.findFirst({ where: { reference, restaurantId, ...(branchId ? { branchId } : {}) }, select: { id: true } });
      if (!scopedOrder) return { kind: 'NOT_FOUND' as const };
      await tx.$queryRaw`SELECT id FROM "CustomerOrder" WHERE id = ${scopedOrder.id} FOR UPDATE`;
      const order = await tx.customerOrder.findUniqueOrThrow({ where: { id: scopedOrder.id }, include: { items: true } });
      if (order.status !== OrderStatus.PREPARING) return { kind: 'INVALID_ORDER_STATE' as const };
      const remaining = order.items.filter((item) => item.kitchenStatus === KitchenItemStatus.PREPARING);
      if (!remaining.length) return { kind: 'INVALID_ITEM_STATE' as const };
      const readyAt = new Date();
      await tx.customerOrderItem.updateMany({ where: { id: { in: remaining.map((item) => item.id) }, orderId: order.id, kitchenStatus: KitchenItemStatus.PREPARING }, data: { kitchenStatus: KitchenItemStatus.READY, readyAt } });
      await tx.kitchenItemEvent.createMany({ data: remaining.map((item) => ({ orderItemId: item.id, previousStatus: KitchenItemStatus.PREPARING, status: KitchenItemStatus.READY, staffUserId })) });
      const orderChanged = await tx.customerOrder.updateMany({ where: { id: order.id, status: OrderStatus.PREPARING }, data: { status: OrderStatus.READY } });
      if (orderChanged.count) await tx.orderEvent.create({ data: { orderId: order.id, previousStatus: OrderStatus.PREPARING, status: OrderStatus.READY, staffUserId } });
      return { kind: 'OK' as const, order: await tx.customerOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export const kitchenRepository = new KitchenRepository();
