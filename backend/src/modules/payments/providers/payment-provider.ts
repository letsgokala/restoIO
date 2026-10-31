import type { Prisma } from '../../../generated/prisma/index.js';

export type OnlineProviderId = 'CHAPA' | 'TELEBIRR';
export type ProviderPaymentState = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
export type ProviderPaymentIntent = { providerReference: string; checkoutUrl: string; expiresAt: Date | null; metadata?: Prisma.InputJsonValue };
export type VerifiedProviderPayment = { providerReference: string; merchantReference: string; state: ProviderPaymentState; amount: Prisma.Decimal; currency: string; transactionReference?: string };

/** Provider contract. No adapter is registered until its merchant sandbox credentials and callback verification have been tested. */
export interface OnlinePaymentProvider {
  readonly id: OnlineProviderId;
  createIntent(input: { amount: Prisma.Decimal; currency: string; merchantReference: string; returnUrl: string; callbackUrl: string }): Promise<ProviderPaymentIntent>;
  verifyPayment(providerReference: string): Promise<VerifiedProviderPayment>;
  verifyWebhook(input: { headers: Headers; rawBody: Uint8Array }): Promise<{ providerReference: string }>;
}
