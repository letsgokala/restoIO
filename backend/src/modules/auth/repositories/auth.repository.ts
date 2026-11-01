import type { PrismaClient } from '../../../generated/prisma/index.js';
export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}
  findUserByEmail(email: string) { return this.db.user.findUnique({ where: { email }, include: { memberships: { where: { isActive: true, restaurant: { status: { in: ['ACTIVE', 'PENDING'] } }, OR: [{ branchId: null }, { branch: { is: { isActive: true } } }] }, include: { restaurant: true, branch: true } } } }); }
  createFirstPlatformAdmin(input: { email: string; displayName: string; passwordHash: string }) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(739104, 1)`;
      if (await tx.user.count({ where: { isPlatformAdmin: true } })) throw new Error('PLATFORM_ADMIN_EXISTS');
      if (await tx.user.findUnique({ where: { email: input.email }, select: { id: true } })) throw new Error('ADMIN_EMAIL_EXISTS');
      return tx.user.create({ data: { ...input, isPlatformAdmin: true } });
    });
  }
  createSession(input: { userId: string; restaurantId?: string; tokenHash: string; expiresAt: Date }) { return this.db.staffSession.create({ data: { ...input, restaurantId: input.restaurantId ?? null } }); }
  findSession(tokenHash: string, now: Date) { return this.db.staffSession.findFirst({ where: { tokenHash, revokedAt: null, expiresAt: { gt: now }, user: { isActive: true } }, include: { user: true } }); }
  revokeSession(tokenHash: string, now: Date) { return this.db.staffSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: now } }); }
  findActiveBranch(restaurantId: string, branchId: string) { return this.db.branch.findFirst({ where: { id: branchId, restaurantId, isActive: true }, select: { id: true } }); }
  async findMembership(userId: string, restaurantId: string, branchId?: string) {
    const owner = await this.db.membership.findFirst({ where: { userId, restaurantId, role: 'RESTAURANT_OWNER', isActive: true, restaurant: { status: 'ACTIVE' } } });
    if (owner) return owner;
    return this.db.membership.findFirst({ where: { userId, restaurantId, isActive: true, restaurant: { status: 'ACTIVE' }, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) } });
  }
}
