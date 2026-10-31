import { Prisma } from '../../generated/prisma/index.js';
import { AppError } from '../../shared/errors/app-error.js';
import { cashierRepository } from './cashier.repository.js';

const notFound = () => new AppError(404, 'SESSION_NOT_FOUND', 'Open table session not found');
function mapError(error: unknown): never {
  if (error instanceof Error) {
    const errors: Record<string, [number, string, string]> = {
      SESSION_NOT_FOUND: [404, 'SESSION_NOT_FOUND', 'Open table session not found'],
      SESSION_CLOSED: [409, 'SESSION_CLOSED', 'This table session is already closed'],
      SESSION_HAS_NO_ORDERS: [409, 'SESSION_HAS_NO_ORDERS', 'This session has no billable orders'],
      MIXED_CURRENCY_SESSION: [409, 'MIXED_CURRENCY_SESSION', 'A session cannot contain orders in different currencies'],
      INVALID_AMOUNT: [400, 'INVALID_AMOUNT', 'Payment amount must be greater than zero'],
      PAYMENT_EXCEEDS_BALANCE: [409, 'PAYMENT_EXCEEDS_BALANCE', 'Payment amount exceeds the remaining balance'],
      ORDERS_NOT_SERVED: [409, 'ORDERS_NOT_SERVED', 'Serve or cancel all orders before closing the table session'],
      SESSION_HAS_BALANCE: [409, 'SESSION_HAS_BALANCE', 'Pay the remaining balance before closing the table session'],
      IDEMPOTENCY_KEY_REUSED: [409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different payment'],
      PAYMENT_NOT_FOUND: [404, 'PAYMENT_NOT_FOUND', 'Payment record not found'],
      PAYMENT_NOT_REVERSIBLE: [409, 'PAYMENT_NOT_REVERSIBLE', 'Only a completed payment can be voided'],
      CLOSED_SESSION_REFUND: [409, 'CLOSED_SESSION_REFUND', 'A closed table session cannot be refunded here; use the restaurant’s audited post-close refund procedure'],
    };
    const mapped = errors[error.message];
    if (mapped) throw new AppError(mapped[0], mapped[1], mapped[2]);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new AppError(409, 'PAYMENT_CONFLICT', 'The session changed while recording payment. Refresh and retry.');
  throw error;
}

export class CashierService {
  listSessions(restaurantId: string, branchId: string | null) { return cashierRepository.listSessions(restaurantId, branchId); }
  async getSession(id: string, restaurantId: string, branchId: string | null) { const result = await cashierRepository.getSession(id, restaurantId, branchId); if (!result) throw notFound(); return result; }
  async recordPayment(sessionId: string, restaurantId: string, branchId: string | null, userId: string, input: { amount: string; method: 'CASH' | 'PAY_AT_COUNTER' | 'PAY_WAITER' | 'OTHER'; idempotencyKey: string; transactionReference?: string; note?: string }) {
    try {
      const amount = new Prisma.Decimal(input.amount);
      const result = await cashierRepository.recordPayment({ ...input, amount, sessionId, restaurantId, branchId, userId });
      const session = await cashierRepository.getSession(sessionId, restaurantId, branchId);
      return { ...result.payment, replayed: result.replayed, session };
    } catch (error) { return mapError(error); }
  }
  async closeSession(sessionId: string, restaurantId: string, branchId: string | null, userId: string) { try { return await cashierRepository.closeSession(sessionId, restaurantId, branchId, userId); } catch (error) { return mapError(error); } }
  async voidPayment(paymentId: string, restaurantId: string, branchId: string | null, userId: string, reason: string) { try { return await cashierRepository.voidPayment(paymentId, restaurantId, branchId, userId, reason); } catch (error) { return mapError(error); } }
  async refundPayment(paymentId: string, restaurantId: string, branchId: string | null, userId: string, reason: string) { try { return await cashierRepository.refundPayment(paymentId, restaurantId, branchId, userId, reason); } catch (error) { return mapError(error); } }
}
export const cashierService = new CashierService();
