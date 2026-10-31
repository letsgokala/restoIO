import { OrderStatus, Prisma, RecordedPaymentStatus } from '../../generated/prisma/index.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export class AnalyticsRepository {
  async report(restaurantId: string, branchId: string | null, from: Date, to: Date) {
    const scope = { restaurantId, ...(branchId ? { branchId } : {}), createdAt: { gte: from, lt: to } };
    const orderWhere = { ...scope };
    const paymentWhere = { ...scope, status: RecordedPaymentStatus.SUCCEEDED };
    const [restaurant, orders, orderStatuses, paymentsByMethod, paymentsByBranch, bestItems, categoryPerformance, daily, busyHours, busyDays, operations] = await Promise.all([
      prisma.restaurant.findUniqueOrThrow({
        where: { id: restaurantId },
        select: {
          currency: true,
          timezone: true,
          branches: { where: { isActive: true, ...(branchId ? { id: branchId } : {}) }, select: { id: true, name: true } },
        },
      }),
      prisma.customerOrder.findMany({ where: orderWhere, select: { status: true, total: true, currency: true, paymentStatus: true, paymentAllocations: { where: { payment: { status: RecordedPaymentStatus.SUCCEEDED } }, select: { amount: true } } } }),
      prisma.customerOrder.groupBy({ by: ['status'], where: orderWhere, _count: { _all: true } }),
      prisma.payment.groupBy({ by: ['method', 'currency'], where: paymentWhere, _sum: { amount: true }, _count: { _all: true } }),
      prisma.payment.groupBy({ by: ['branchId', 'currency'], where: paymentWhere, _sum: { amount: true }, _count: { _all: true } }),
      prisma.customerOrderItem.groupBy({ by: ['nameSnapshot'], where: { order: { ...scope, status: { notIn: [OrderStatus.REJECTED, OrderStatus.CANCELLED] } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 100 }),
      prisma.$queryRaw<Array<{ categoryId: string; category: string; quantity: bigint; revenue: Prisma.Decimal }>>`SELECT c."id" AS "categoryId", c."name" AS "category", COALESCE(SUM(CASE WHEN o."id" IS NOT NULL THEN oi."quantity" ELSE 0 END),0)::bigint AS "quantity", COALESCE(SUM(CASE WHEN o."id" IS NOT NULL THEN oi."lineTotal" ELSE 0 END),0)::numeric AS "revenue" FROM "MenuCategory" c JOIN "MenuItem" mi ON mi."categoryId"=c."id" LEFT JOIN "CustomerOrderItem" oi ON oi."menuItemId"=mi."id" LEFT JOIN "CustomerOrder" o ON o."id"=oi."orderId" AND o."restaurantId"=${restaurantId} AND o."createdAt">=${from} AND o."createdAt"<${to} AND o."status" NOT IN ('REJECTED','CANCELLED') ${branchId ? Prisma.sql`AND o."branchId"=${branchId}` : Prisma.empty} WHERE c."restaurantId"=${restaurantId} AND c."isActive"=true GROUP BY c."id",c."name" ORDER BY "quantity" DESC`,
      prisma.$queryRaw<Array<{ day: string; amount: Prisma.Decimal }>>`SELECT to_char(date_trunc('day', timezone(${Prisma.raw('"Restaurant"."timezone"')}, p."createdAt")), 'YYYY-MM-DD') AS day, SUM(p."amount") AS amount FROM "Payment" p JOIN "Restaurant" ON "Restaurant"."id" = p."restaurantId" WHERE p."restaurantId" = ${restaurantId} AND p."status" = 'SUCCEEDED' AND p."createdAt" >= ${from} AND p."createdAt" < ${to} ${branchId ? Prisma.sql`AND p."branchId" = ${branchId}` : Prisma.empty} GROUP BY 1 ORDER BY 1` ,
      prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`SELECT EXTRACT(HOUR FROM timezone(r."timezone", o."createdAt"))::int AS hour, COUNT(*)::bigint AS count FROM "CustomerOrder" o JOIN "Restaurant" r ON r."id"=o."restaurantId" WHERE o."restaurantId"=${restaurantId} AND o."createdAt">=${from} AND o."createdAt"<${to} AND o."status" NOT IN ('REJECTED','CANCELLED') ${branchId ? Prisma.sql`AND o."branchId"=${branchId}` : Prisma.empty} GROUP BY hour ORDER BY count DESC,hour ASC LIMIT 5`,
      prisma.$queryRaw<Array<{ dayOfWeek: number; count: bigint }>>`SELECT EXTRACT(ISODOW FROM timezone(r."timezone", o."createdAt"))::int AS "dayOfWeek", COUNT(*)::bigint AS count FROM "CustomerOrder" o JOIN "Restaurant" r ON r."id"=o."restaurantId" WHERE o."restaurantId"=${restaurantId} AND o."createdAt">=${from} AND o."createdAt"<${to} AND o."status" NOT IN ('REJECTED','CANCELLED') ${branchId ? Prisma.sql`AND o."branchId"=${branchId}` : Prisma.empty} GROUP BY "dayOfWeek" ORDER BY count DESC,"dayOfWeek" ASC`,
      prisma.$queryRaw<Array<{ averageConfirmationMinutes: number | null; averagePreparationMinutes: number | null; averageReadyToServedMinutes: number | null }>>`SELECT
        (SELECT AVG(EXTRACT(EPOCH FROM (confirmed."createdAt" - pending."createdAt")) / 60) FROM "OrderEvent" pending JOIN "OrderEvent" confirmed ON confirmed."orderId" = pending."orderId" AND confirmed."status" = 'CONFIRMED' WHERE pending."status" = 'PENDING_CONFIRMATION' AND pending."createdAt" >= ${from} AND pending."createdAt" < ${to} AND EXISTS (SELECT 1 FROM "CustomerOrder" o WHERE o."id" = confirmed."orderId" AND o."restaurantId" = ${restaurantId} ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty})) AS "averageConfirmationMinutes",
        (SELECT AVG(EXTRACT(EPOCH FROM (i."readyAt" - i."preparationStartedAt")) / 60) FROM "CustomerOrderItem" i JOIN "CustomerOrder" o ON o."id" = i."orderId" WHERE o."restaurantId" = ${restaurantId} AND i."preparationStartedAt" IS NOT NULL AND i."readyAt" IS NOT NULL AND o."createdAt" >= ${from} AND o."createdAt" < ${to} ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty}) AS "averagePreparationMinutes",
        (SELECT AVG(EXTRACT(EPOCH FROM (served."createdAt" - ready."createdAt")) / 60) FROM "OrderEvent" ready JOIN "OrderEvent" served ON served."orderId" = ready."orderId" AND served."status" = 'SERVED' WHERE ready."status" = 'READY' AND ready."createdAt" >= ${from} AND ready."createdAt" < ${to} AND EXISTS (SELECT 1 FROM "CustomerOrder" o WHERE o."id" = served."orderId" AND o."restaurantId" = ${restaurantId} ${branchId ? Prisma.sql`AND o."branchId" = ${branchId}` : Prisma.empty})) AS "averageReadyToServedMinutes"`,
    ]);
    const usedCurrencies = new Set([...orders.filter((order) => order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.REJECTED).map((order) => order.currency.trim()), ...paymentsByMethod.map((row) => row.currency.trim())]);
    if (usedCurrencies.size > 1) throw new AppError(409, 'MIXED_CURRENCY_REPORT', 'The selected report range contains multiple currencies. Filter to a date range with one currency before comparing totals.');
    const reportCurrency = [...usedCurrencies][0] ?? restaurant.currency.trim();
    const revenue = paymentsByMethod.reduce((sum, row) => sum.add(row._sum.amount ?? 0), new Prisma.Decimal(0));
    const ordersTotal = orders.reduce((sum, order) => order.status === OrderStatus.REJECTED || order.status === OrderStatus.CANCELLED ? sum : sum.add(order.total), new Prisma.Decimal(0));
    const paidByOrders = orders.reduce((sum, order) => sum.add(order.paymentAllocations.reduce((paid, allocation) => paid.add(allocation.amount), new Prisma.Decimal(0))), new Prisma.Decimal(0));
    const branchNames = new Map(restaurant.branches.map((b) => [b.id, b.name]));
    const operationsRow = operations[0];
    const statuses = Object.fromEntries(orderStatuses.map((row) => [row.status, row._count._all]));
    const weekly = new Map<string, Prisma.Decimal>();
    const monthly = new Map<string, Prisma.Decimal>();
    for (const row of daily) {
      const day = new Date(`${row.day}T00:00:00.000Z`);
      const monday = new Date(day); monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
      const weekKey = monday.toISOString().slice(0, 10);
      const monthKey = row.day.slice(0, 7);
      weekly.set(weekKey, (weekly.get(weekKey) ?? new Prisma.Decimal(0)).add(row.amount));
      monthly.set(monthKey, (monthly.get(monthKey) ?? new Prisma.Decimal(0)).add(row.amount));
    }
    return {
      currency: reportCurrency, timezone: restaurant.timezone, from: from.toISOString(), to: to.toISOString(),
      sales: { revenueReceived: revenue.toFixed(2), paidOrderValue: paidByOrders.toFixed(2), unpaidOrderValue: Prisma.Decimal.max(0, ordersTotal.sub(paidByOrders)).toFixed(2), orderValue: ordersTotal.toFixed(2), byPaymentMethod: paymentsByMethod.map((row) => ({ method: row.method, amount: (row._sum.amount ?? new Prisma.Decimal(0)).toFixed(2), count: row._count._all })), byBranch: paymentsByBranch.map((row) => ({ branchId: row.branchId, branch: branchNames.get(row.branchId) ?? 'Inactive branch', amount: (row._sum.amount ?? new Prisma.Decimal(0)).toFixed(2), count: row._count._all })), daily: daily.map((row) => ({ day: row.day, amount: row.amount.toFixed(2) })), weekly: [...weekly].map(([weekStarting, amount]) => ({ weekStarting, amount: amount.toFixed(2) })), monthly: [...monthly].map(([month, amount]) => ({ month, amount: amount.toFixed(2) })) },
      orders: { total: orders.filter((o) => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REJECTED).length, byStatus: statuses, averageOrderValue: (() => { const count = orders.filter((o) => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.REJECTED).length; return count ? ordersTotal.div(count).toFixed(2) : '0.00'; })(), busyHours: busyHours.map((row) => ({ hour: row.hour, count: Number(row.count) })), busyDays: busyDays.map((row) => ({ dayOfWeek: row.dayOfWeek, count: Number(row.count) })) },
      menu: { bestSelling: bestItems.slice(0, 10).map((row) => ({ name: row.nameSnapshot, quantity: row._sum.quantity ?? 0, revenue: (row._sum.lineTotal ?? new Prisma.Decimal(0)).toFixed(2) })), leastOrdered: [...bestItems].sort((a, b) => (a._sum.quantity ?? 0) - (b._sum.quantity ?? 0)).slice(0, 10).map((row) => ({ name: row.nameSnapshot, quantity: row._sum.quantity ?? 0, revenue: (row._sum.lineTotal ?? new Prisma.Decimal(0)).toFixed(2) })), categories: categoryPerformance.map((row) => ({ categoryId: row.categoryId, name: row.category, quantity: Number(row.quantity), revenue: row.revenue.toFixed(2) })) },
      operations: { averageConfirmationMinutes: Number(operationsRow?.averageConfirmationMinutes ?? 0), averagePreparationMinutes: Number(operationsRow?.averagePreparationMinutes ?? 0), averageReadyToServedMinutes: Number(operationsRow?.averageReadyToServedMinutes ?? 0) },
    };
  }
}
export const analyticsRepository = new AnalyticsRepository();
