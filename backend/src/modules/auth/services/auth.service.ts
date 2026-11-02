import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import type { AuthRepository } from '../repositories/auth.repository.js';
import type { LoginDto } from '../dtos/login.dto.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { toAuthResponse } from '../mappers/auth.mapper.js';
const digest = (token: string): string => createHash('sha256').update(token).digest('hex');
const fakePasswordHash = '$argon2id$v=19$m=65536,t=3,p=4$cmFuZG9tU2FsdFZhbHVlMTIzNDU2Nw$Z2VuZXJpY0hhc2hSZXByZXNlbnRhdGlvbg';
export class AuthService {
  constructor(private readonly repository: AuthRepository, private readonly sessionTtlHours: number) {}
  async bootstrapPlatformAdmin(input: { email: string; displayName: string; password: string }) {
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try { return await this.repository.createFirstPlatformAdmin({ email: input.email, displayName: input.displayName, passwordHash }); }
    catch (error) {
      if (error instanceof Error && error.message === 'PLATFORM_ADMIN_EXISTS') throw new AppError(409, 'PLATFORM_ADMIN_EXISTS', 'The initial platform administrator has already been created');
      if (error instanceof Error && error.message === 'ADMIN_EMAIL_EXISTS') throw new AppError(409, 'ADMIN_EMAIL_EXISTS', 'That email already belongs to an account. Choose a new email for the platform administrator.');
      throw error;
    }
  }
  async login(input: LoginDto) {
    const user = await this.repository.findUserByEmail(input.email);
    const validPassword = await argon2.verify(user?.passwordHash ?? fakePasswordHash, input.password).catch(() => false);
    if (!user || !user.isActive || !validPassword) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    const activeMemberships = user.memberships.filter((membership) => membership.restaurant.status === 'ACTIVE');
    if (!user.isPlatformAdmin && activeMemberships.length === 0 && user.memberships.some((membership) => membership.restaurant.status === 'PENDING')) throw new AppError(403, 'ACCOUNT_PENDING_APPROVAL', 'Your restaurant signup is awaiting platform approval. Please try again after it has been approved.');
    if (!user.isPlatformAdmin && activeMemberships.length === 0) throw new AppError(403, 'NO_ACTIVE_MEMBERSHIP', 'This account has no active restaurant access');
    if (input.restaurantId && !user.isPlatformAdmin && !activeMemberships.some((m) => m.restaurantId === input.restaurantId)) throw new AppError(403, 'TENANT_FORBIDDEN', 'You do not have access to this restaurant');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 3600000);
    await this.repository.createSession({ userId: user.id, restaurantId: input.restaurantId, tokenHash: digest(token), expiresAt });
    return { token, expiresAt, body: toAuthResponse({ ...user, memberships: activeMemberships }) };
  }
  async authenticate(token: string) {
    const session = await this.repository.findSession(digest(token), new Date());
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue');
    return { user: { id: session.user.id, email: session.user.email, displayName: session.user.displayName, isPlatformAdmin: session.user.isPlatformAdmin }, sessionId: session.id, restaurantId: session.restaurantId };
  }
  async authorizeTenant(userId: string, isPlatformAdmin: boolean, restaurantId: string, branchId?: string) {
    if (branchId && !(await this.repository.findActiveBranch(restaurantId, branchId))) throw new AppError(404, 'BRANCH_NOT_FOUND', 'The requested active branch was not found');
    if (isPlatformAdmin) return { restaurantId, branchId: branchId ?? null, role: 'PLATFORM_ADMIN' as const };
    const membership = await this.repository.findMembership(userId, restaurantId, branchId);
    if (!membership) throw new AppError(403, 'TENANT_FORBIDDEN', 'You do not have access to this restaurant or branch');
    return { restaurantId, branchId: branchId ?? (membership.role === 'RESTAURANT_OWNER' ? null : membership.branchId), role: membership.role };
  }
  async logout(token: string) { await this.repository.revokeSession(digest(token), new Date()); }
}
