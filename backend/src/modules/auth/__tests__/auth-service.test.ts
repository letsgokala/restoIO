import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
describe('AuthService tenant scope', () => {
  it('denies access if the requested restaurant is not an active membership', async () => {
    const repo = { findMembership: vi.fn().mockResolvedValue(null), findActiveBranch: vi.fn() } as never;
    const service = new AuthService(repo, 12);
    await expect(service.authorizeTenant('user-1', false, 'restaurant-other')).rejects.toMatchObject({ status: 403, code: 'TENANT_FORBIDDEN' } satisfies Partial<AppError>);
    expect(repo.findMembership).toHaveBeenCalledWith('user-1', 'restaurant-other', undefined);
  });
  it('rejects an inactive or cross-tenant branch before checking membership', async () => {
    const repo = { findActiveBranch: vi.fn().mockResolvedValue(null), findMembership: vi.fn() } as never;
    const service = new AuthService(repo, 12);
    await expect(service.authorizeTenant('user-1', false, 'restaurant-1', 'branch-other')).rejects.toMatchObject({ status: 404, code: 'BRANCH_NOT_FOUND' });
    expect(repo.findMembership).not.toHaveBeenCalled();
  });
  it('requires a platform administrator for platform-wide bypass', async () => {
    const repo = { findMembership: vi.fn() } as never;
    const service = new AuthService(repo, 12);
    await service.authorizeTenant('admin-1', true, 'restaurant-1');
    expect(repo.findMembership).not.toHaveBeenCalled();
  });
});
