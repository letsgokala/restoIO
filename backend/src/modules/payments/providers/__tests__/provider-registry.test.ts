import { describe, expect, it } from 'vitest';
import { paymentProviderRegistry } from '../provider-registry.js';

describe('online payment provider registry', () => {
  it('keeps Chapa and Telebirr disabled until verified adapters are registered', () => {
    const providers = paymentProviderRegistry.availability();
    expect(providers.map(({ id, enabled, reason }) => ({ id, enabled, reason }))).toEqual([
      { id: 'CHAPA', enabled: false, reason: 'ADAPTER_NOT_CONFIGURED' },
      { id: 'TELEBIRR', enabled: false, reason: 'ADAPTER_NOT_CONFIGURED' },
    ]);
    expect(() => paymentProviderRegistry.get('CHAPA')).toThrow(/not enabled/);
    expect(() => paymentProviderRegistry.get('TELEBIRR')).toThrow(/not enabled/);
  });
});
