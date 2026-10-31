import { AppError } from '../../../shared/errors/app-error.js';
import type { OnlinePaymentProvider, OnlineProviderId } from './payment-provider.js';

export type ProviderAvailability = { id: OnlineProviderId; enabled: false; reason: 'ADAPTER_NOT_CONFIGURED'; credentialsPresent: boolean };
const requiredCredentials: Record<OnlineProviderId, string[]> = {
  CHAPA: ['CHAPA_SECRET_KEY', 'CHAPA_WEBHOOK_SECRET'],
  TELEBIRR: ['TELEBIRR_APP_ID', 'TELEBIRR_APP_KEY', 'TELEBIRR_MERCHANT_CODE', 'TELEBIRR_PRIVATE_KEY', 'TELEBIRR_PUBLIC_KEY'],
};
const adapters = new Map<OnlineProviderId, OnlinePaymentProvider>();

export const paymentProviderRegistry = {
  availability(): ProviderAvailability[] {
    return (Object.keys(requiredCredentials) as OnlineProviderId[]).map((id) => ({
      id,
      enabled: false,
      reason: 'ADAPTER_NOT_CONFIGURED',
      credentialsPresent: requiredCredentials[id].every((name) => Boolean(process.env[name])),
    }));
  },
  get(id: OnlineProviderId): OnlinePaymentProvider {
    const adapter = adapters.get(id);
    if (!adapter) throw new AppError(503, 'PAYMENT_PROVIDER_DISABLED', `${id} checkout is not enabled. Configure and verify its provider adapter before accepting online payments.`);
    return adapter;
  },
  /** Used only by a provider adapter bootstrap and its tests. */
  register(adapter: OnlinePaymentProvider) { adapters.set(adapter.id, adapter); },
};
