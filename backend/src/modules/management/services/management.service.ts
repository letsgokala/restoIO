import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { Prisma, UserRole } from '../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { managementRepository, type MenuItemInput } from '../repositories/management.repository.js';
import { decryptQrToken, encryptQrToken } from './qr-crypto.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const mapDbError = (error: unknown): never => {
  if (error instanceof Error) {
    if (error.message === 'CATEGORY_HAS_ITEMS') throw new AppError(409, 'CATEGORY_HAS_ITEMS', 'Move or archive this category’s items before deleting it');
    if (error.message === 'CATEGORY_NOT_FOUND') throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Menu category not found');
    if (error.message === 'BRANCH_NOT_FOUND') throw new AppError(400, 'BRANCH_NOT_FOUND', 'Select active branches belonging to this restaurant');
    if (error.message === 'OWNER_ACCOUNT_INVALID' || error.message === 'STAFF_ACCOUNT_INVALID') throw new AppError(409, 'ACCOUNT_INVALID', 'This email belongs to a platform administrator');
    if (error.message === 'OWNER_ACCOUNT_EXISTS') throw new AppError(409, 'OWNER_ACCOUNT_EXISTS', 'That email already has a staff account. Choose a new email for this restaurant owner.');
    if (error.message === 'USER_INACTIVE') throw new AppError(409, 'USER_INACTIVE', 'This account is disabled. Contact a platform administrator.');
    if (error.message === 'MEMBERSHIP_EXISTS') throw new AppError(409, 'MEMBERSHIP_EXISTS', 'This person already has that role and branch assignment');
    if (error.message === 'OWNER_REQUIRED') throw new AppError(403, 'OWNER_REQUIRED', 'Only an active restaurant owner can add another restaurant to this account');
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new AppError(409, 'DUPLICATE_VALUE', 'That email, slug, or table label is already in use');
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new AppError(404, 'RESOURCE_NOT_FOUND', 'The requested management record was not found');
  throw error;
};

export class ManagementService {
  async listPlatformRestaurants() {
    return (await managementRepository.platformRestaurants()).map(({ memberships, ...restaurant }) => ({ ...restaurant, currency: restaurant.currency.trim(), owner: memberships[0]?.user ?? null, branchCount: restaurant.branches.length, activeBranchCount: restaurant.branches.filter((branch) => branch.isActive).length, usage: { orders: restaurant._count.orders, sessions: restaurant._count.tableSessions } }));
  }
  async setPlatformRestaurantStatus(id: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') {
    try { const result = await managementRepository.setRestaurantStatus(id, status); if (!result.count) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found'); return { updated: true, status }; } catch (error) { return mapDbError(error); }
  }
  async listAccessibleRestaurants(userId: string) {
    const records = await managementRepository.accessibleRestaurants(userId);
    const memberships = records as Array<{ restaurant: { id: string; name: string; slug: string; currency: string; branches: { id: string; name: string; isActive: boolean }[] }; branchId: string | null; role: UserRole }>;
    const output = new Map<string, { id: string; name: string; slug: string; currency: string; role: UserRole; branchIds: string[] | null; branches: { id: string; name: string; isActive: boolean }[] }>();
    const priority: UserRole[] = [UserRole.RESTAURANT_OWNER, UserRole.MANAGER, UserRole.WAITER, UserRole.KITCHEN, UserRole.CASHIER];
    for (const membership of memberships) {
      const current = output.get(membership.restaurant.id);
      const branchIds = current?.branchIds === null || membership.role === UserRole.RESTAURANT_OWNER || membership.branchId === null ? null : [...(current?.branchIds ?? []), membership.branchId];
      output.set(membership.restaurant.id, { id: membership.restaurant.id, name: membership.restaurant.name, slug: membership.restaurant.slug, currency: membership.restaurant.currency, role: current && priority.indexOf(current.role) < priority.indexOf(membership.role) ? current.role : membership.role, branchIds, branches: membership.restaurant.branches.filter((b) => branchIds === null || branchIds.includes(b.id)) });
    }
    return [...output.values()].map((r) => ({ ...r, branchIds: r.branchIds ? [...new Set(r.branchIds)] : null }));
  }
  async createRestaurant(input: { name: string; slug: string; description?: string; logoUrl?: string; coverImageUrl?: string; contactPhone?: string; websiteUrl?: string; currency: string; timezone: string; branchName: string; branchSlug: string; branchAddress?: string; ownerEmail: string; ownerName: string; password: string }) {
    const { password, ...restaurantInput } = input;
    try { return await managementRepository.createRestaurantWithOwner({ ...restaurantInput, ownerEmail: input.ownerEmail.toLowerCase(), passwordHash: await argon2.hash(password, { type: argon2.argon2id }) }); } catch (error) { return mapDbError(error); }
  }
  async requestRestaurant(input: { name: string; slug: string; description?: string; logoUrl?: string; coverImageUrl?: string; contactPhone?: string; websiteUrl?: string; currency: string; timezone: string; branchName: string; branchSlug: string; branchAddress?: string; ownerEmail: string; ownerName: string; password: string }) {
    const { password, ...restaurantInput } = input;
    try { return await managementRepository.createRestaurantWithOwner({ ...restaurantInput, status: 'PENDING', ownerEmail: input.ownerEmail.toLowerCase(), passwordHash: await argon2.hash(password, { type: argon2.argon2id }) }); } catch (error) { return mapDbError(error); }
  }
  async createOwnedRestaurant(userId: string, input: { name: string; slug: string; description?: string; logoUrl?: string; coverImageUrl?: string; contactPhone?: string; websiteUrl?: string; currency: string; timezone: string; branchName: string; branchSlug: string; branchAddress?: string }) { try { return await managementRepository.createRestaurantForOwner(userId, input); } catch (error) { return mapDbError(error); } }
  getRestaurant(restaurantId: string) { return managementRepository.getRestaurant(restaurantId).then((r) => { if (!r) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found'); return r; }); }
  async updateRestaurant(restaurantId: string, input: { name?: string; slug?: string; description?: string | null; logoUrl?: string | null; coverImageUrl?: string | null; contactPhone?: string | null; websiteUrl?: string | null; currency?: string; timezone?: string }) { try { return await managementRepository.updateRestaurant(restaurantId, input); } catch (error) { return mapDbError(error); } }
  listBranches(restaurantId: string, branchId: string | null) { return managementRepository.listBranches(restaurantId, branchId); }
  async getBranchHours(restaurantId: string, branchId: string, tenantBranchId: string | null) { if (tenantBranchId && tenantBranchId !== branchId) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found'); const result = await managementRepository.getBranchHours(restaurantId, branchId); if (!result) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found'); return result; }
  async updateBranchHours(restaurantId: string, branchId: string, tenantBranchId: string | null, hours: { dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }[]) { if (tenantBranchId && tenantBranchId !== branchId) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found'); const result = await managementRepository.replaceBranchHours(restaurantId, branchId, hours); if (!result) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found'); return result; }
  async createBranch(restaurantId: string, input: { name: string; slug: string; address?: string }) { try { return await managementRepository.createBranch(restaurantId, input); } catch (error) { return mapDbError(error); } }
  async updateBranch(restaurantId: string, id: string, input: { name?: string; slug?: string; address?: string | null; isActive?: boolean }) { try { const result = await managementRepository.updateBranch(restaurantId, id, input); if (!result.count) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found'); return { updated: true }; } catch (error) { return mapDbError(error); } }
  async deleteBranch(restaurantId: string, id: string) { const branch = await managementRepository.branchUsage(restaurantId, id); if (!branch) throw new AppError(404, 'BRANCH_NOT_FOUND', 'Branch not found'); if (Object.values(branch._count).some(Boolean)) throw new AppError(409, 'BRANCH_IN_USE', 'This branch has tables, staff, orders, or sessions. Deactivate it instead.'); await managementRepository.deleteBranch(restaurantId, id); return { deleted: true }; }
  listStaff(restaurantId: string, branchId: string | null) { return managementRepository.listStaff(restaurantId, branchId); }
  async createStaff(restaurantId: string, input: { email: string; displayName: string; password: string; role: UserRole; branchId: string | null }, tenantBranchId: string | null) { if (input.branchId && tenantBranchId && input.branchId !== tenantBranchId) throw new AppError(403, 'BRANCH_FORBIDDEN', 'You cannot assign staff outside your branch'); if (input.branchId && !(await managementRepository.listBranches(restaurantId, input.branchId)).some((b) => b.isActive)) throw new AppError(400, 'BRANCH_NOT_FOUND', 'Select an active branch in this restaurant'); try { return await managementRepository.createStaff({ ...input, restaurantId, email: input.email.toLowerCase(), passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }) }); } catch (error) { return mapDbError(error); } }
  async updateStaff(restaurantId: string, membershipId: string, input: { role?: UserRole; branchId?: string | null; isActive?: boolean }, tenantBranchId: string | null) { if (input.branchId && tenantBranchId && input.branchId !== tenantBranchId) throw new AppError(403, 'BRANCH_FORBIDDEN', 'You cannot assign staff outside your branch'); if (input.branchId && !(await managementRepository.listBranches(restaurantId, input.branchId)).some((b) => b.isActive)) throw new AppError(400, 'BRANCH_NOT_FOUND', 'Select an active branch in this restaurant'); try { const result = await managementRepository.updateMembership(restaurantId, membershipId, input); if (!result.count) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Staff assignment not found'); return { updated: true }; } catch (error) { return mapDbError(error); } }
  async listTables(restaurantId: string, branchId: string | null) {
    return (await managementRepository.listTables(restaurantId, branchId)).map((table) => ({ id: table.id, label: table.label, isActive: table.isActive, branch: table.branch, orderCount: table._count.orders, hasOpenSession: table.tableSessions.length > 0, qrCodes: table.qrTokens.map((qr) => ({ id: qr.id, isActive: qr.isActive, createdAt: qr.createdAt, revokedAt: qr.revokedAt, expiresAt: qr.expiresAt, path: qr.isActive && qr.tokenCiphertext ? `/q/${decryptQrToken(qr.tokenCiphertext)}` : null })) }));
  }
  async createTable(restaurantId: string, branchId: string, label: string, tenantBranchId: string | null) { if (tenantBranchId && tenantBranchId !== branchId) throw new AppError(403, 'BRANCH_FORBIDDEN', 'You cannot assign a table outside your branch'); if (!(await managementRepository.listBranches(restaurantId, branchId)).some((b) => b.isActive)) throw new AppError(400, 'BRANCH_NOT_FOUND', 'Select an active branch in this restaurant'); try { return await managementRepository.createTable(restaurantId, branchId, label); } catch (error) { return mapDbError(error); } }
  async updateTable(restaurantId: string, id: string, input: { label?: string; isActive?: boolean; branchId?: string }, tenantBranchId: string | null) {
    if (input.branchId && tenantBranchId && input.branchId !== tenantBranchId) throw new AppError(403, 'BRANCH_FORBIDDEN', 'You cannot assign a table outside your branch');
    if (input.branchId && !(await managementRepository.listBranches(restaurantId, input.branchId)).some((b) => b.isActive)) throw new AppError(400, 'BRANCH_NOT_FOUND', 'Select an active branch in this restaurant');
    const use = await managementRepository.tableUsage(restaurantId, id);
    if (!use || (tenantBranchId && use.branchId !== tenantBranchId)) throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found');
    if (input.branchId && use.branchId !== input.branchId && use._count.tableSessions) throw new AppError(409, 'TABLE_HAS_HISTORY', 'A table with service history cannot move branches');
    try { const result = await managementRepository.updateTable(restaurantId, id, input); if (!result.count) throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found'); return { updated: true }; } catch (error) { return mapDbError(error); }
  }
  async deleteTable(restaurantId: string, id: string, tenantBranchId: string | null) { const table = await managementRepository.tableUsage(restaurantId, id); if (!table || (tenantBranchId && table.branchId !== tenantBranchId)) throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found'); if (table._count.orders || table._count.tableSessions || table._count.assistanceRequests) throw new AppError(409, 'TABLE_HAS_HISTORY', 'This table has service history. Deactivate it instead.'); await managementRepository.deleteTable(restaurantId, id); return { deleted: true }; }
  async generateQr(restaurantId: string, tableId: string, tenantBranchId: string | null) {
    const table = await managementRepository.tableUsage(restaurantId, tableId);
    if (!table || (tenantBranchId && table.branchId !== tenantBranchId)) throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found');
    const token = randomBytes(32).toString('base64url');
    const qr = await managementRepository.rotateQr(restaurantId, tableId, hash(token), encryptQrToken(token));
    if (!qr) throw new AppError(409, 'TABLE_UNAVAILABLE', 'Only an active table in an active branch can receive a QR code');
    return { id: qr.id, token, path: `/q/${token}`, createdAt: qr.createdAt };
  }
  async disableQr(restaurantId: string, tableId: string, qrId: string, tenantBranchId: string | null) { const table = await managementRepository.tableUsage(restaurantId, tableId); if (!table || (tenantBranchId && table.branchId !== tenantBranchId)) throw new AppError(404, 'TABLE_NOT_FOUND', 'Table not found'); const result = await managementRepository.disableQr(restaurantId, tableId, qrId); if (!result.count) throw new AppError(404, 'QR_NOT_FOUND', 'Active table QR not found'); return { disabled: true }; }
  listMenu(restaurantId: string) { return managementRepository.listMenu(restaurantId); }
  async createCategory(restaurantId: string, input: { name: string; sortOrder: number; translations: { locale: string; name: string }[] }) { try { return await managementRepository.createCategory(restaurantId, input); } catch (error) { return mapDbError(error); } }
  async updateCategory(restaurantId: string, id: string, input: { name: string; sortOrder: number; isActive: boolean; translations: { locale: string; name: string }[] }) { const result = await managementRepository.updateCategory(restaurantId, id, input); if (!result) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Menu category not found'); return result; }
  async deleteCategory(restaurantId: string, id: string) { try { const result = await managementRepository.deleteCategory(restaurantId, id); if (!result) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Menu category not found'); return { deleted: true }; } catch (error) { return mapDbError(error); } }
  async saveMenuItem(restaurantId: string, id: string | null, input: MenuItemInput) { try { return await managementRepository.saveMenuItem(restaurantId, id, input); } catch (error) { return mapDbError(error); } }
  async archiveMenuItem(restaurantId: string, id: string) { const result = await managementRepository.archiveMenuItem(restaurantId, id); if (!result.count) throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found'); return { archived: true }; }
}
export const managementService = new ManagementService();
