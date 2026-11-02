import { AssistanceStatus, OrderStatus, Prisma, UserRole } from '../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { customerRepository } from '../../customer/repositories/customer.repository.js';
import { waiterRepository } from '../repositories/waiter.repository.js';

const transitions: Record<string, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  WAITER: { PENDING_CONFIRMATION: [OrderStatus.CONFIRMED, OrderStatus.REJECTED], READY: [OrderStatus.SERVED] },
  KITCHEN: {},
  CASHIER: { SERVED: [OrderStatus.CLOSED] },
  RESTAURANT_OWNER: { PENDING_CONFIRMATION: [OrderStatus.CONFIRMED, OrderStatus.REJECTED], CONFIRMED: [OrderStatus.CANCELLED], PREPARING: [OrderStatus.CANCELLED], READY: [OrderStatus.SERVED] },
  MANAGER: { PENDING_CONFIRMATION: [OrderStatus.CONFIRMED, OrderStatus.REJECTED], CONFIRMED: [OrderStatus.CANCELLED], PREPARING: [OrderStatus.CANCELLED], READY: [OrderStatus.SERVED] },
};
const completedStatuses = new Set<OrderStatus>([OrderStatus.SERVED, OrderStatus.CLOSED]);
const assistanceRoles = new Set<UserRole>([UserRole.WAITER, UserRole.MANAGER, UserRole.RESTAURANT_OWNER]);

export class WaiterService {
  async getDashboard(restaurantId: string, branchId: string | null, filters: { status?: OrderStatus; tableId?: string; date?: string; search?: string }) {
    const result = await waiterRepository.dashboard(restaurantId, branchId, filters);
    const orders = result.orders.map((order) => ({ id: order.id, reference: order.reference, status: order.status, paymentStatus: order.paymentStatus, currency: order.currency.trim(), subtotal: order.subtotal.toString(), total: order.total.toString(), note: order.note, createdAt: order.createdAt, updatedAt: order.updatedAt, restaurant: order.restaurant, branch: order.branch, table: order.table, tableSessionId: order.tableSessionId, items: order.items.map((item) => ({ name: item.nameSnapshot, quantity: item.quantity, unitPrice: item.unitPrice.toString(), lineTotal: item.lineTotal.toString(), customizations: item.customizations, specialInstructions: item.specialInstructions })), events: order.events.map((event) => ({ previousStatus: event.previousStatus, status: event.status, note: event.note, createdAt: event.createdAt, staffName: event.staffUser?.displayName ?? null })) }));
    const sessions = result.sessions.map((session) => ({ id: session.id, openedAt: session.openedAt, branch: session.branch, table: session.table, orderCount: session.orders.length, pendingCount: session.orders.filter((order) => order.status === OrderStatus.PENDING_CONFIRMATION).length, completedCount: session.orders.filter((order) => completedStatuses.has(order.status)).length, total: session.orders.reduce((total, order) => total.add(order.total), new Prisma.Decimal(0)).toFixed(2), currency: session.orders[0]?.currency.trim() ?? 'ETB', orders: session.orders.map((order) => ({ reference: order.reference, status: order.status, total: order.total.toString(), currency: order.currency.trim(), createdAt: order.createdAt, items: order.items.map((item) => ({ name: item.nameSnapshot, quantity: item.quantity, customizations: item.customizations })) })) }));
    const tables = result.tables.map((table) => { const session = table.tableSessions[0] ?? null; return { id: table.id, label: table.label, branch: table.branch, isOccupied: !!session, session: session ? { openedAt: session.openedAt, orderCount: session.orders.length, total: session.orders.reduce((sum, order) => sum.add(order.total), new Prisma.Decimal(0)).toFixed(2), currency: session.orders[0]?.currency.trim() ?? 'ETB', pendingCount: session.orders.filter((order) => order.status === OrderStatus.PENDING_CONFIRMATION).length } : null }; });
    const assistanceRequests = result.assistanceRequests.map((request) => ({ id: request.id, kind: request.kind, status: request.status, createdAt: request.createdAt, updatedAt: request.updatedAt, handledAt: request.handledAt, handledBy: request.handledBy?.displayName ?? null, branch: request.branch, table: request.table, events: request.events.map((event) => ({ previousStatus: event.previousStatus, status: event.status, note: event.note, createdAt: event.createdAt, staffName: event.staffUser?.displayName ?? null })) }));
    return { orders, sessions, tables, assistanceRequests, generatedAt: new Date().toISOString() };
  }

  async transitionOrder(reference: string, status: OrderStatus, restaurantId: string, branchId: string | null, role: UserRole, staffUserId: string | null, reason?: string) {
    const order = await customerRepository.findTenantOrder(reference, restaurantId, branchId);
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (status === OrderStatus.REJECTED && !reason?.trim()) throw new AppError(400, 'REJECTION_REASON_REQUIRED', 'Add a reason before rejecting this order');
    if (status === OrderStatus.CANCELLED && !reason?.trim()) throw new AppError(400, 'CANCELLATION_REASON_REQUIRED', 'Add a reason before cancelling this order');
    if (!(transitions[role]?.[order.status] ?? []).includes(status)) throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'This role cannot make that order status change');
    try {
      const updated = await customerRepository.transitionOrder({ reference, restaurantId, branchId, expected: order.status, status, staffUserId, note: reason?.trim(), requirePaid: status === OrderStatus.CLOSED });
      if (!updated) throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'This order changed. Refresh and try again.');
      return updated;
    } catch (error) {
      if (error instanceof Error && error.message === 'ORDER_NOT_PAID') throw new AppError(409, 'PAYMENT_REQUIRED', 'A cashier can close this order only after payment is recorded');
      throw error;
    }
  }

  async updateAssistance(requestId: string, status: AssistanceStatus, restaurantId: string, branchId: string | null, staffUserId: string, role: UserRole) {
    if (!assistanceRoles.has(role)) throw new AppError(403, 'ROLE_FORBIDDEN', 'Your role cannot handle customer assistance requests');
    const expected = status === AssistanceStatus.ACKNOWLEDGED ? AssistanceStatus.OPEN : AssistanceStatus.ACKNOWLEDGED;
    if (status !== AssistanceStatus.ACKNOWLEDGED && status !== AssistanceStatus.RESOLVED) throw new AppError(400, 'INVALID_ASSISTANCE_STATUS', 'Requests can be acknowledged or marked handled');
    const updated = await customerRepository.transitionAssistance({ id: requestId, restaurantId, branchId, expected, status, staffUserId });
    if (!updated) {
      const existing = await customerRepository.findAssistanceStatus(requestId, restaurantId, branchId);
      if (!existing) throw new AppError(404, 'ASSISTANCE_NOT_FOUND', 'Assistance request not found');
      throw new AppError(409, 'INVALID_ASSISTANCE_TRANSITION', 'This request was already updated');
    }
    return updated;
  }
}

export const waiterService = new WaiterService();
