import { apiRequest } from '../../lib/api/client';

export type CashierSession = { id: string; openedAt: string; branchId: string; branch: { name: string }; table: { label: string }; orderCount: number; currency: string; total: string; paid: string; balance: string; statuses: string[] };
export type CashierBill = { id: string; openedAt: string; closedAt: string | null; branch: { name: string }; table: { label: string }; currency: string; total: string; paid: string; balance: string; orders: { id: string; reference: string; status: string; paymentStatus: string; currency: string; total: string; createdAt: string; items: { name: string; quantity: number; unitPrice: string; lineTotal: string }[] }[]; payments: { id: string; amount: string; currency: string; method: string; status: string; transactionReference: string | null; note: string | null; createdAt: string; recordedBy: string | null; allocations: { orderReference: string; amount: string }[] }[] };
export type CashierApi = <T>(path: string, init?: RequestInit) => Promise<T>;
export const getCashierSessions = (api: CashierApi) => api<CashierSession[]>('/tenant/cashier/sessions');
export const getCashierBill = (api: CashierApi, id: string) => api<CashierBill>(`/tenant/cashier/sessions/${id}`);
export const recordSessionPayment = (api: CashierApi, id: string, body: { amount: string; method: string; idempotencyKey: string }) => api(`/tenant/cashier/sessions/${id}/payments`, { method: 'POST', body: JSON.stringify(body) });
export const closeCashierSession = (api: CashierApi, id: string) => api(`/tenant/cashier/sessions/${id}/close`, { method: 'POST' });
