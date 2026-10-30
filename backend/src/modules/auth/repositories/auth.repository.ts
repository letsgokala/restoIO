import type { PrismaClient } from '../../../generated/prisma/index.js';
export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}
  findUserByEmail(email: string) { return this.db.user.findUnique({ where: { email }, include: { memberships: { where: { isActive: true, restaurant: { status: 'ACTIVE' }, OR: [{ branchId: null }, { branch: { is: { isActive: true } } }] }, include: { restaurant: true, branch: true } } } }); }
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
