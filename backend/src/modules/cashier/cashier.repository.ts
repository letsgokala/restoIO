import { OrderStatus, PaymentStatus, Prisma, RecordedPaymentStatus } from '../../generated/prisma/index.js';
import { prisma } from '../../config/prisma.js';

const eligibleOrder = { status: { notIn: [OrderStatus.REJECTED, OrderStatus.CANCELLED] } };
type Db = typeof prisma;
type Tx = Prisma.TransactionClient;

async function sessionSummary(db: Db | Tx, sessionId: string, restaurantId: string, branchId: string | null) {
  return db.tableSession.findFirst({ where: { id: sessionId, restaurantId, ...(branchId ? { branchId } : {}) }, include: {
    branch: { select: { id: true, name: true } }, table: { select: { id: true, label: true } },
    orders: { where: eligibleOrder, orderBy: { createdAt: 'asc' }, include: { items: { select: { id: true, nameSnapshot: true, quantity: true, unitPrice: true, lineTotal: true } }, paymentAllocations: { where: { payment: { status: RecordedPaymentStatus.SUCCEEDED } }, select: { amount: true } } } },
    payments: { orderBy: { createdAt: 'desc' }, include: { recordedBy: { select: { displayName: true } }, allocations: { include: { order: { select: { reference: true } } } }, audits: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { displayName: true } } } } } },
  } });
}
const decimal = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value);
function calculate(session: NonNullable<Awaited<ReturnType<typeof sessionSummary>>>) {
  const currency = session.orders[0]?.currency.trim() ?? 'ETB';
  const subtotal = session.orders.reduce((sum, order) => sum.add(order.total), decimal(0));
  const paid = session.payments.filter((payment) => payment.status === RecordedPaymentStatus.SUCCEEDED).reduce((sum, payment) => sum.add(payment.amount), decimal(0));
  const balance = Prisma.Decimal.max(decimal(0), subtotal.sub(paid));
  return { currency, subtotal, paid, balance };
}
function dto(session: NonNullable<Awaited<ReturnType<typeof sessionSummary>>>) {
  const totals = calculate(session);
  return { id: session.id, openedAt: session.openedAt, closedAt: session.closedAt, branch: session.branch, table: session.table,
    currency: totals.currency, total: totals.subtotal.toFixed(2), paid: totals.paid.toFixed(2), balance: totals.balance.toFixed(2),
    orders: session.orders.map((order) => ({ id: order.id, reference: order.reference, status: order.status, paymentStatus: order.paymentStatus, currency: order.currency.trim(), total: order.total.toFixed(2), createdAt: order.createdAt, items: order.items.map((item) => ({ name: item.nameSnapshot, quantity: item.quantity, unitPrice: item.unitPrice.toFixed(2), lineTotal: item.lineTotal.toFixed(2) })) })),
    payments: session.payments.map((payment) => ({ id: payment.id, amount: payment.amount.toFixed(2), currency: payment.currency.trim(), method: payment.method, status: payment.status, transactionReference: payment.transactionReference, note: payment.note, createdAt: payment.createdAt, recordedBy: payment.recordedBy?.displayName ?? null, allocations: payment.allocations.map((allocation) => ({ orderReference: allocation.order.reference, amount: allocation.amount.toFixed(2) })), audits: payment.audits.map((audit) => ({ action: audit.action, note: audit.note, createdAt: audit.createdAt, actor: audit.actor?.displayName ?? null })) })),
  };
}

export class CashierRepository {
  listSessions(restaurantId: string, branchId: string | null) {
    return prisma.tableSession.findMany({ where: { restaurantId, closedAt: null, ...(branchId ? { branchId } : {}) }, orderBy: { openedAt: 'asc' }, select: { id: true, openedAt: true, branchId: true, branch: { select: { name: true } }, table: { select: { label: true } }, orders: { where: eligibleOrder, select: { total: true, currency: true, status: true, paymentStatus: true, paymentAllocations: { where: { payment: { status: RecordedPaymentStatus.SUCCEEDED } }, select: { amount: true } } } }, payments: { where: { status: RecordedPaymentStatus.SUCCEEDED }, select: { amount: true } } } }).then((sessions) => sessions.map((session) => {
      const currency = session.orders[0]?.currency.trim() ?? 'ETB';
      const total = session.orders.reduce((sum, order) => sum.add(order.total), decimal(0));
      const paid = session.payments.reduce((sum, payment) => sum.add(payment.amount), decimal(0));
      return { id: session.id, openedAt: session.openedAt, branchId: session.branchId, branch: session.branch, table: session.table, orderCount: session.orders.length, currency, total: total.toFixed(2), paid: paid.toFixed(2), balance: Prisma.Decimal.max(decimal(0), total.sub(paid)).toFixed(2), statuses: session.orders.map((order) => order.status) };
    }));
  }
  async getSession(sessionId: string, restaurantId: string, branchId: string | null) {
    const session = await sessionSummary(prisma, sessionId, restaurantId, branchId);
    return session ? dto(session) : null;
  }
  async recordPayment(input: { sessionId: string; restaurantId: string; branchId: string | null; userId: string; amount: Prisma.Decimal; method: Prisma.PaymentCreateInput['method']; idempotencyKey: string; transactionReference?: string; note?: string }) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TableSession" WHERE "id" = ${input.sessionId} FOR UPDATE`;
      const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) {
        if (existing.tableSessionId !== input.sessionId || existing.restaurantId !== input.restaurantId || !existing.amount.equals(input.amount) || existing.method !== input.method) throw new Error('IDEMPOTENCY_KEY_REUSED');
        return { payment: existing, replayed: true };
      }
      const session = await sessionSummary(tx, input.sessionId, input.restaurantId, input.branchId);
      if (!session) throw new Error('SESSION_NOT_FOUND');
      if (session.closedAt) throw new Error('SESSION_CLOSED');
      if (session.orders.length === 0) throw new Error('SESSION_HAS_NO_ORDERS');
      const totals = calculate(session);
      if (session.orders.some((order) => order.currency.trim() !== totals.currency)) throw new Error('MIXED_CURRENCY_SESSION');
      if (!input.amount.greaterThan(0)) throw new Error('INVALID_AMOUNT');
      if (input.amount.greaterThan(totals.balance)) throw new Error('PAYMENT_EXCEEDS_BALANCE');
      const payment = await tx.payment.create({ data: { restaurantId: input.restaurantId, branchId: session.branchId, tableSessionId: session.id, recordedByUserId: input.userId, idempotencyKey: input.idempotencyKey, amount: input.amount, currency: totals.currency, method: input.method, transactionReference: input.transactionReference, note: input.note } });
      let remaining = input.amount;
      for (const order of session.orders) {
        if (remaining.isZero()) break;
        const alreadyPaid = order.paymentAllocations.reduce((sum, allocation) => sum.add(allocation.amount), decimal(0));
        const orderBalance = Prisma.Decimal.max(decimal(0), order.total.sub(alreadyPaid));
        if (orderBalance.isZero()) continue;
        const allocationAmount = Prisma.Decimal.min(remaining, orderBalance);
        await tx.paymentAllocation.create({ data: { paymentId: payment.id, orderId: order.id, amount: allocationAmount } });
        remaining = remaining.sub(allocationAmount);
        const orderPaid = alreadyPaid.add(allocationAmount);
        const nextStatus = orderPaid.greaterThanOrEqualTo(order.total) ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
        await tx.customerOrder.update({ where: { id: order.id }, data: { paymentStatus: nextStatus } });
      }
      await tx.paymentAudit.create({ data: { paymentId: payment.id, actorUserId: input.userId, action: 'RECORDED', note: input.note ?? `Recorded ${input.method} payment of ${input.amount.toFixed(2)} ${totals.currency}` } });
      return { payment, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async closeSession(sessionId: string, restaurantId: string, branchId: string | null, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TableSession" WHERE "id" = ${sessionId} FOR UPDATE`;
      const session = await sessionSummary(tx, sessionId, restaurantId, branchId);
      if (!session) throw new Error('SESSION_NOT_FOUND');
      if (session.closedAt) throw new Error('SESSION_CLOSED');
      if (session.orders.some((order) => order.status !== OrderStatus.SERVED && order.status !== OrderStatus.CLOSED)) throw new Error('ORDERS_NOT_SERVED');
      if (!calculate(session).balance.isZero()) throw new Error('SESSION_HAS_BALANCE');
      const now = new Date();
      for (const order of session.orders) if (order.status === OrderStatus.SERVED) {
        await tx.customerOrder.update({ where: { id: order.id }, data: { status: OrderStatus.CLOSED } });
        await tx.orderEvent.create({ data: { orderId: order.id, previousStatus: OrderStatus.SERVED, status: OrderStatus.CLOSED, staffUserId: userId, note: 'Table session closed after payment' } });
      }
      await tx.tableSession.update({ where: { id: sessionId }, data: { closedAt: now } });
      return { closed: true, closedAt: now };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async voidPayment(paymentId: string, restaurantId: string, branchId: string | null, userId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId, restaurantId, ...(branchId ? { branchId } : {}) }, include: { allocations: { include: { order: true } } } });
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      await tx.$queryRaw`SELECT "id" FROM "TableSession" WHERE "id" = ${payment.tableSessionId} FOR UPDATE`;
      const fresh = await tx.payment.findUnique({ where: { id: paymentId }, include: { allocations: true } });
      if (!fresh || fresh.status !== RecordedPaymentStatus.SUCCEEDED) throw new Error('PAYMENT_NOT_REVERSIBLE');
      await tx.payment.update({ where: { id: paymentId }, data: { status: RecordedPaymentStatus.VOIDED } });
      await tx.paymentAudit.create({ data: { paymentId, actorUserId: userId, action: 'VOIDED', note: reason } });
      for (const allocation of fresh.allocations) {
        const paid = await tx.paymentAllocation.aggregate({ where: { orderId: allocation.orderId, payment: { status: RecordedPaymentStatus.SUCCEEDED } }, _sum: { amount: true } });
        const amount = paid._sum.amount ?? decimal(0);
        const order = await tx.customerOrder.findUniqueOrThrow({ where: { id: allocation.orderId }, select: { total: true } });
        await tx.customerOrder.update({ where: { id: allocation.orderId }, data: { paymentStatus: amount.isZero() ? PaymentStatus.UNPAID : amount.greaterThanOrEqualTo(order.total) ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID } });
      }
      return { voided: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async refundPayment(paymentId: string, restaurantId: string, branchId: string | null, userId: string, reason: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId, restaurantId, ...(branchId ? { branchId } : {}) }, select: { id: true, tableSessionId: true, status: true } });
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      await tx.$queryRaw`SELECT "id" FROM "TableSession" WHERE "id" = ${payment.tableSessionId} FOR UPDATE`;
      const fresh = await tx.payment.findUnique({ where: { id: paymentId }, include: { allocations: { include: { order: { select: { status: true } } } }, tableSession: { select: { closedAt: true } } } });
      if (!fresh || fresh.status !== RecordedPaymentStatus.SUCCEEDED) throw new Error('PAYMENT_NOT_REVERSIBLE');
      if (fresh.tableSession.closedAt || fresh.allocations.some((allocation) => allocation.order.status === OrderStatus.CLOSED)) throw new Error('CLOSED_SESSION_REFUND');
      await tx.payment.update({ where: { id: paymentId }, data: { status: RecordedPaymentStatus.REFUNDED } });
      await tx.paymentAudit.create({ data: { paymentId, actorUserId: userId, action: 'REFUNDED', note: reason } });
      for (const allocation of fresh.allocations) {
        const paid = await tx.paymentAllocation.aggregate({ where: { orderId: allocation.orderId, payment: { status: RecordedPaymentStatus.SUCCEEDED } }, _sum: { amount: true } });
        const amount = paid._sum.amount ?? decimal(0);
        const order = await tx.customerOrder.findUniqueOrThrow({ where: { id: allocation.orderId }, select: { total: true } });
        await tx.customerOrder.update({ where: { id: allocation.orderId }, data: { paymentStatus: amount.isZero() ? PaymentStatus.UNPAID : amount.greaterThanOrEqualTo(order.total) ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID } });
      }
      return { refunded: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async sessionForService(sessionId: string, restaurantId: string, branchId: string | null) { return sessionSummary(prisma, sessionId, restaurantId, branchId); }
}

export const cashierRepository = new CashierRepository();
