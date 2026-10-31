import { describe, expect, it } from 'vitest';
import { secureRandomHex, secureRandomUUID } from './random';

describe('secure browser random values', () => {
  it('creates hexadecimal guest tokens with the requested entropy length', () => {
    expect(secureRandomHex(32)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('creates UUID v4 idempotency keys without randomUUID()', () => {
    expect(secureRandomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
