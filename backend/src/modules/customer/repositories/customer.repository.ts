import { Prisma, type AssistanceKind, type OrderStatus } from '../../../generated/prisma/index.js';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../../config/prisma.js';

export class CustomerRepository {
  findQr(tokenHash: string) { return prisma.qRToken.findUnique({ where: { tokenHash }, include: { table: { include: { branch: { include: { restaurant: true } } } } } }); }
  findQrBranch(tokenHash: string) { return prisma.qRToken.findUniqueOrThrow({ where: { tokenHash }, select: { branchId: true } }); }
  findMenu(restaurantSlug: string, branchId: string, locale: string) {
    return prisma.menuCategory.findMany({ where: { restaurant: { slug: restaurantSlug, status: 'ACTIVE' }, isActive: true }, orderBy: { sortOrder: 'asc' }, include: { translations: { where: { locale } }, items: { where: { isActive: true }, orderBy: { name: 'asc' }, include: { translations: { where: { locale } }, branchAvailability: { where: { branchId }, select: { isAvailable: true } }, modifierGroups: { orderBy: { sortOrder: 'asc' }, include: { translations: { where: { locale } }, options: { where: { isAvailable: true }, include: { translations: { where: { locale } } } } } } } } } });
  }
  findOrderByKey(idempotencyKey: string) { return prisma.customerOrder.findUnique({ where: { idempotencyKey }, include: orderInclude }); }
  createOrder(input: { qrHash: string; restaurantId: string; branchId: string; tableId: string; currency: string; note?: string; idempotencyKey: string; guestTokenHash: string; guestTokenExpiresAt: Date; itemPublicIds: string[]; calculate: (items: CheckoutMenuItem[]) => { subtotal: Prisma.Decimal; lines: CalculatedOrderLine[] } }) {
    const reference = `R-${randomBytes(8).toString('hex').toUpperCase()}`;
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DiningTable" WHERE id = ${input.tableId} FOR UPDATE`;
      const qr = await tx.qRToken.findUnique({ where: { tokenHash: input.qrHash }, include: { table: { include: { branch: { include: { restaurant: true } } } } } });
      if (!qr || !qr.isActive || qr.revokedAt || (qr.expiresAt && qr.expiresAt <= new Date()) || !qr.table.isActive || !qr.table.branch.isActive || qr.table.branch.restaurant.status !== 'ACTIVE' || qr.restaurantId !== input.restaurantId || qr.branchId !== input.branchId || qr.tableId !== input.tableId) throw new Error('CHECKOUT_TABLE_UNAVAILABLE');
      const menuItems = await tx.menuItem.findMany({ where: { publicId: { in: input.itemPublicIds }, restaurantId: input.restaurantId, isActive: true, branchAvailability: { some: { branchId: input.branchId, isAvailable: true } } }, include: checkoutInclude });
      const { subtotal, lines } = input.calculate(menuItems);
      let session = await tx.tableSession.findFirst({ where: { tableId: input.tableId, closedAt: null }, orderBy: { openedAt: 'desc' } });
      if (!session) session = await tx.tableSession.create({ data: { restaurantId: input.restaurantId, branchId: input.branchId, tableId: input.tableId } });
      return tx.customerOrder.create({ data: { reference, restaurantId: input.restaurantId, branchId: input.branchId, tableId: input.tableId, tableSessionId: session.id, currency: input.currency, subtotal, total: subtotal, note: input.note, idempotencyKey: input.idempotencyKey, guestTokenHash: input.guestTokenHash, guestTokenExpiresAt: input.guestTokenExpiresAt, items: { create: lines }, events: { create: { status: 'PENDING_CONFIRMATION' } } }, include: orderInclude });
    });
  }
  findOrder(reference: string) { return prisma.customerOrder.findUnique({ where: { reference }, include: orderInclude }); }
  findTenantOrder(reference: string, restaurantId: string, branchId: string | null) { return prisma.customerOrder.findFirst({ where: { reference, restaurantId, ...(branchId ? { branchId } : {}) } }); }
  transitionOrder(input: { reference: string; restaurantId: string; branchId: string | null; expected: OrderStatus; status: OrderStatus; staffUserId: string | null; note?: string; requirePaid?: boolean }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findFirst({ where: { reference: input.reference, restaurantId: input.restaurantId, ...(input.branchId ? { branchId: input.branchId } : {}), status: input.expected } });
      if (!order) return null;
      if (input.requirePaid && order.paymentStatus !== 'PAID') throw new Error('ORDER_NOT_PAID');
      const changed = await tx.customerOrder.updateMany({ where: { id: order.id, status: input.expected }, data: { status: input.status } });
      if (!changed.count) return null;
      await tx.orderEvent.create({ data: { orderId: order.id, previousStatus: input.expected, status: input.status, staffUserId: input.staffUserId, note: input.note } });
      return tx.customerOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    });
  }
  findWaiterOrder(reference: string, restaurantId: string, branchId: string | null) { return prisma.customerOrder.findFirst({ where: { reference, restaurantId, ...(branchId ? { branchId } : {}) }, include: { table: { select: { label: true } }, branch: { select: { name: true } }, items: true, events: { orderBy: { createdAt: 'asc' }, include: { staffUser: { select: { displayName: true } } } } } }); }
  findTableSession(tableId: string) { return prisma.tableSession.findFirst({ where: { tableId, closedAt: null }, orderBy: { openedAt: 'desc' } }); }
  transitionAssistance(input: { id: string; restaurantId: string; branchId: string | null; expected: 'OPEN' | 'ACKNOWLEDGED'; status: 'ACKNOWLEDGED' | 'RESOLVED'; staffUserId: string }) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.assistanceRequest.findFirst({ where: { id: input.id, restaurantId: input.restaurantId, ...(input.branchId ? { branchId: input.branchId } : {}), status: input.expected } });
      if (!current) return null;
      const changed = await tx.assistanceRequest.updateMany({ where: { id: current.id, status: input.expected }, data: { status: input.status, handledAt: new Date(), handledByUserId: input.staffUserId } });
      if (!changed.count) return null;
      await tx.assistanceRequestEvent.create({ data: { requestId: current.id, previousStatus: input.expected, status: input.status, staffUserId: input.staffUserId } });
      return tx.assistanceRequest.findUniqueOrThrow({ where: { id: current.id }, include: { table: { select: { label: true } }, branch: { select: { name: true } }, events: { orderBy: { createdAt: 'asc' }, include: { staffUser: { select: { displayName: true } } } } } });
    });
  }
  findAssistanceStatus(id: string, restaurantId: string, branchId: string | null) { return prisma.assistanceRequest.findFirst({ where: { id, restaurantId, ...(branchId ? { branchId } : {}) }, select: { status: true } }); }
  findGuestAssistance(reference: string, guestTokenHash: string) {
    return prisma.assistanceRequest.findFirst({ where: { reference, guestTokenHash, guestTokenExpiresAt: { gt: new Date() } }, select: { reference: true, kind: true, status: true, createdAt: true, updatedAt: true, handledAt: true, table: { select: { label: true } }, events: { orderBy: { createdAt: 'asc' }, select: { previousStatus: true, status: true, note: true, createdAt: true } } } });
  }
  createAssistanceWithinLimit(input: { restaurantId: string; branchId: string; tableId: string; kind: AssistanceKind; since: Date; reference: string; guestTokenHash: string; guestTokenExpiresAt: Date }) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DiningTable" WHERE id = ${input.tableId} FOR UPDATE`;
      const recent = await tx.assistanceRequest.count({ where: { tableId: input.tableId, kind: input.kind, createdAt: { gt: input.since } } });
      if (recent >= 3) return { request: null, rateLimited: true };
      const session = (await tx.tableSession.findFirst({ where: { tableId: input.tableId, closedAt: null } })) ?? await tx.tableSession.create({ data: { restaurantId: input.restaurantId, branchId: input.branchId, tableId: input.tableId } });
      const request = await tx.assistanceRequest.create({ data: { restaurantId: input.restaurantId, branchId: input.branchId, tableId: input.tableId, tableSessionId: session.id, kind: input.kind, reference: input.reference, guestTokenHash: input.guestTokenHash, guestTokenExpiresAt: input.guestTokenExpiresAt, events: { create: { status: 'OPEN' } } } });
      return { request, rateLimited: false };
    });
  }
}

const orderInclude = { items: true, events: { orderBy: { createdAt: 'asc' as const } }, table: { select: { label: true } } };
const checkoutInclude = { modifierGroups: { include: { options: { where: { isAvailable: true } } } } } satisfies Prisma.MenuItemInclude;
type CheckoutMenuItem = Prisma.MenuItemGetPayload<{ include: typeof checkoutInclude }>;
type CalculatedOrderLine = { menuItemId: string; nameSnapshot: string; unitPrice: Prisma.Decimal; quantity: number; lineTotal: Prisma.Decimal; customizations: Prisma.InputJsonValue; specialInstructions?: string };
export const customerRepository = new CustomerRepository();
