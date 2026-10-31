import { OrderStatus } from '../../../generated/prisma/index.js';
import { prisma } from '../../../config/prisma.js';

const staffOrderInclude = { restaurant: { select: { name: true } }, branch: { select: { id: true, name: true } }, table: { select: { id: true, label: true } }, items: true, events: { orderBy: { createdAt: 'asc' as const }, include: { staffUser: { select: { displayName: true } } } } };

export class WaiterRepository {
  async dashboard(restaurantId: string, branchId: string | null, filters: { status?: OrderStatus; tableId?: string; date?: string; search?: string }) {
    const dayStart = filters.date ? new Date(`${filters.date}T00:00:00.000Z`) : null;
    const normalizedRange = dayStart ? { createdAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } } : undefined;
    const search = filters.search?.trim();
    const historyStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const assistanceStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const orders = await prisma.customerOrder.findMany({
      where: {
        restaurantId,
        ...(branchId ? { branchId } : {}),
        ...(filters.tableId ? { tableId: filters.tableId } : {}),
        ...(filters.status ? { status: filters.status } : filters.date ? {} : { OR: [{ status: { in: [OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] } }, { status: { in: [OrderStatus.SERVED, OrderStatus.CLOSED, OrderStatus.REJECTED, OrderStatus.CANCELLED] }, createdAt: { gte: historyStart } }] }),
        ...(normalizedRange ?? {}),
        ...(search ? { AND: [{ OR: [
          { reference: { contains: search, mode: 'insensitive' } },
          { table: { is: { label: { contains: search, mode: 'insensitive' } } } },
          { items: { some: { nameSnapshot: { contains: search, mode: 'insensitive' } } } },
        ] }] } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], take: 500, include: staffOrderInclude,
    });
    const [tables, sessions, assistanceRequests] = await Promise.all([
      prisma.diningTable.findMany({ where: { restaurantId, isActive: true, ...(branchId ? { branchId } : {}) }, orderBy: [{ branch: { name: 'asc' } }, { label: 'asc' }], include: { branch: { select: { id: true, name: true } }, tableSessions: { where: { closedAt: null }, orderBy: { openedAt: 'desc' }, take: 1, include: { orders: { orderBy: { createdAt: 'asc' }, select: { reference: true, status: true, total: true, currency: true, createdAt: true, items: { select: { nameSnapshot: true, quantity: true, customizations: true } } } } } } } }),
      prisma.tableSession.findMany({ where: { restaurantId, closedAt: null, ...(branchId ? { branchId } : {}) }, orderBy: { openedAt: 'asc' }, include: { branch: { select: { id: true, name: true } }, table: { select: { id: true, label: true } }, orders: { orderBy: { createdAt: 'asc' }, select: { reference: true, status: true, total: true, currency: true, createdAt: true, items: { select: { nameSnapshot: true, quantity: true, customizations: true } } } } } }),
      prisma.assistanceRequest.findMany({ where: { restaurantId, ...(branchId ? { branchId } : {}), createdAt: { gte: assistanceStart } }, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }], take: 250, include: { branch: { select: { id: true, name: true } }, table: { select: { id: true, label: true } }, events: { orderBy: { createdAt: 'asc' }, include: { staffUser: { select: { displayName: true } } } }, handledBy: { select: { displayName: true } } } }),
    ]);
    return { orders, tables, sessions, assistanceRequests };
  }
}

export const waiterRepository = new WaiterRepository();
