import { describe, expect, it } from 'vitest';
import { prisma } from '../../../config/prisma.js';
import { acquirePlatformAdminBootstrapLock } from '../repositories/auth.repository.js';

describe('platform administrator bootstrap lock', () => {
  it('acquires the transaction lock while returning a Prisma-supported scalar', async () => {
    await expect(prisma.$transaction(async (tx) => acquirePlatformAdminBootstrapLock(tx))).resolves.toBeUndefined();
  });
});
