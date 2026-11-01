import { Prisma, type UserRole } from '../../../generated/prisma/index.js';
import { prisma } from '../../../config/prisma.js';

const menuInclude = { translations: { orderBy: { locale: 'asc' as const } }, items: { orderBy: { name: 'asc' as const }, include: { translations: { orderBy: { locale: 'asc' as const } }, branchAvailability: { include: { branch: { select: { id: true, name: true } } } }, modifierGroups: { orderBy: { sortOrder: 'asc' as const }, include: { translations: { orderBy: { locale: 'asc' as const } }, options: { include: { translations: { orderBy: { locale: 'asc' as const } } } } } } } } };

export class ManagementRepository {
  platformRestaurants() {
    return prisma.restaurant.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, name: true, slug: true, status: true, currency: true, timezone: true, createdAt: true, branches: { select: { id: true, name: true, isActive: true } }, memberships: { where: { role: 'RESTAURANT_OWNER', isActive: true, branchId: null }, select: { user: { select: { email: true, displayName: true } } }, take: 1 }, _count: { select: { orders: true, tableSessions: true } } } });
  }
  setRestaurantStatus(id: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') { return prisma.restaurant.updateMany({ where: { id }, data: { status } }); }
  accessibleRestaurants(userId: string, platformAdmin: boolean) {
    if (platformAdmin) return prisma.restaurant.findMany({ orderBy: { name: 'asc' }, include: { branches: { orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } } } });
    return prisma.membership.findMany({ where: { userId, isActive: true, restaurant: { status: 'ACTIVE' }, OR: [{ branchId: null }, { branch: { is: { isActive: true } } }] }, include: { restaurant: { include: { branches: { orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true } } } }, branch: true }, orderBy: { createdAt: 'asc' } });
  }
  async createRestaurantForOwner(userId: string, input: { name: string; slug: string; description?: string; logoUrl?: string; coverImageUrl?: string; contactPhone?: string; websiteUrl?: string; currency: string; timezone: string; branchName: string; branchSlug: string; branchAddress?: string }) {
    return prisma.$transaction(async (tx) => {
      const owned = await tx.membership.findFirst({ where: { userId, role: 'RESTAURANT_OWNER', isActive: true, restaurant: { status: 'ACTIVE' } } });
      if (!owned) throw new Error('OWNER_REQUIRED');
      const restaurant = await tx.restaurant.create({ data: { name: input.name, slug: input.slug, description: input.description, logoUrl: input.logoUrl, coverImageUrl: input.coverImageUrl, contactPhone: input.contactPhone, websiteUrl: input.websiteUrl, currency: input.currency, timezone: input.timezone } });
      const branch = await tx.branch.create({ data: { restaurantId: restaurant.id, name: input.branchName, slug: input.branchSlug, address: input.branchAddress } });
      await tx.membership.create({ data: { userId, restaurantId: restaurant.id, role: 'RESTAURANT_OWNER' } });
      return { restaurant, branch };
    });
  }
  createRestaurantWithOwner(input: { name: string; slug: string; description?: string; logoUrl?: string; coverImageUrl?: string; contactPhone?: string; websiteUrl?: string; currency: string; timezone: string; branchName: string; branchSlug: string; branchAddress?: string; ownerEmail: string; ownerName: string; passwordHash: string; status?: 'PENDING' | 'ACTIVE' }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: input.ownerEmail } });
      if (existing?.isPlatformAdmin) throw new Error('OWNER_ACCOUNT_INVALID');
      if (existing) throw new Error('OWNER_ACCOUNT_EXISTS');
      const restaurant = await tx.restaurant.create({ data: { name: input.name, slug: input.slug, description: input.description, logoUrl: input.logoUrl, coverImageUrl: input.coverImageUrl, contactPhone: input.contactPhone, websiteUrl: input.websiteUrl, currency: input.currency, timezone: input.timezone, status: input.status ?? 'ACTIVE' } });
      const branch = await tx.branch.create({ data: { restaurantId: restaurant.id, name: input.branchName, slug: input.branchSlug, address: input.branchAddress } });
      const user = await tx.user.create({ data: { email: input.ownerEmail, displayName: input.ownerName, passwordHash: input.passwordHash } });
      await tx.membership.create({ data: { userId: user.id, restaurantId: restaurant.id, role: 'RESTAURANT_OWNER' } });
      return { restaurant, branch, owner: { email: user.email, displayName: user.displayName } };
    });
  }
  getRestaurant(restaurantId: string) { return prisma.restaurant.findUnique({ where: { id: restaurantId }, include: { _count: { select: { branches: true, tables: true, items: true } } } }); }
  updateRestaurant(restaurantId: string, data: Prisma.RestaurantUpdateInput) { return prisma.restaurant.update({ where: { id: restaurantId }, data }); }
  listBranches(restaurantId: string, branchId: string | null) { return prisma.branch.findMany({ where: { restaurantId, ...(branchId ? { id: branchId } : {}) }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { tables: true, memberships: true } } } }); }
  getBranchHours(restaurantId: string, branchId: string) { return prisma.branch.findFirst({ where: { id: branchId, restaurantId }, select: { id: true, operatingHours: { orderBy: { dayOfWeek: 'asc' } } } }); }
  async replaceBranchHours(restaurantId: string, branchId: string, hours: { dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }[]) { return prisma.$transaction(async (tx) => { const branch = await tx.branch.findFirst({ where: { id: branchId, restaurantId }, select: { id: true } }); if (!branch) return null; await tx.branchOperatingHour.deleteMany({ where: { branchId } }); await tx.branchOperatingHour.createMany({ data: hours.map((hour) => ({ ...hour, branchId })) }); return tx.branchOperatingHour.findMany({ where: { branchId }, orderBy: { dayOfWeek: 'asc' } }); }); }
  createBranch(restaurantId: string, data: { name: string; slug: string; address?: string }) { return prisma.branch.create({ data: { restaurantId, ...data } }); }
  updateBranch(restaurantId: string, id: string, data: { name?: string; slug?: string; address?: string | null; isActive?: boolean }) { return prisma.branch.updateMany({ where: { id, restaurantId }, data }); }
  branchUsage(restaurantId: string, id: string) { return prisma.branch.findFirst({ where: { id, restaurantId }, include: { _count: { select: { tables: true, memberships: true, orders: true, tableSessions: true } } } }); }
  deleteBranch(restaurantId: string, id: string) { return prisma.branch.deleteMany({ where: { id, restaurantId } }); }
  listStaff(restaurantId: string, branchId: string | null) { return prisma.membership.findMany({ where: { restaurantId, ...(branchId ? { branchId } : {}) }, include: { user: { select: { id: true, email: true, displayName: true, isActive: true, createdAt: true } }, branch: { select: { id: true, name: true } } }, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] }); }
  async createStaff(input: { restaurantId: string; branchId: string | null; role: UserRole; email: string; displayName: string; passwordHash: string }) {
    return prisma.$transaction(async (tx) => {
      const found = await tx.user.findUnique({ where: { email: input.email } });
      if (found?.isPlatformAdmin) throw new Error('STAFF_ACCOUNT_INVALID');
      if (found && !found.isActive) throw new Error('USER_INACTIVE');
      const user = found ?? await tx.user.create({ data: { email: input.email, displayName: input.displayName, passwordHash: input.passwordHash } });
      const existingMembership = await tx.membership.findFirst({ where: { userId: user.id, restaurantId: input.restaurantId, branchId: input.branchId, role: input.role } });
      if (existingMembership?.isActive) throw new Error('MEMBERSHIP_EXISTS');
      if (existingMembership) await tx.membership.update({ where: { id: existingMembership.id }, data: { isActive: true } });
      else await tx.membership.create({ data: { userId: user.id, restaurantId: input.restaurantId, branchId: input.branchId, role: input.role } });
      return { id: user.id, email: user.email, displayName: user.displayName };
    });
  }
  updateMembership(restaurantId: string, membershipId: string, data: { role?: UserRole; branchId?: string | null; isActive?: boolean }) { return prisma.membership.updateMany({ where: { id: membershipId, restaurantId }, data }); }
  listTables(restaurantId: string, branchId: string | null) { return prisma.diningTable.findMany({ where: { restaurantId, ...(branchId ? { branchId } : {}) }, orderBy: [{ branch: { name: 'asc' } }, { label: 'asc' }], include: { branch: { select: { id: true, name: true } }, qrTokens: { orderBy: { createdAt: 'desc' }, select: { id: true, tokenHash: true, tokenCiphertext: true, isActive: true, createdAt: true, revokedAt: true, expiresAt: true } }, _count: { select: { orders: true, tableSessions: true } }, tableSessions: { where: { closedAt: null }, select: { id: true }, take: 1 } } }); }
  createTable(restaurantId: string, branchId: string, label: string) { return prisma.diningTable.create({ data: { restaurantId, branchId, label } }); }
  updateTable(restaurantId: string, id: string, data: { label?: string; isActive?: boolean; branchId?: string }) { return prisma.diningTable.updateMany({ where: { id, restaurantId }, data }); }
  tableUsage(restaurantId: string, id: string) { return prisma.diningTable.findFirst({ where: { id, restaurantId }, include: { _count: { select: { orders: true, tableSessions: true, assistanceRequests: true } } } }); }
  deleteTable(restaurantId: string, id: string) { return prisma.$transaction(async (tx) => { await tx.qRToken.deleteMany({ where: { tableId: id, restaurantId } }); return tx.diningTable.deleteMany({ where: { id, restaurantId } }); }); }
  rotateQr(restaurantId: string, tableId: string, tokenHash: string, tokenCiphertext: string) {
    return prisma.$transaction(async (tx) => {
      const table = await tx.diningTable.findFirst({ where: { id: tableId, restaurantId, isActive: true, branch: { isActive: true, restaurant: { status: 'ACTIVE' } } } });
      if (!table) return null;
      await tx.qRToken.updateMany({ where: { tableId, restaurantId, isActive: true }, data: { isActive: false, revokedAt: new Date() } });
      return tx.qRToken.create({ data: { restaurantId, branchId: table.branchId, tableId, tokenHash, tokenCiphertext } });
    });
  }
  disableQr(restaurantId: string, tableId: string, qrId: string) { return prisma.qRToken.updateMany({ where: { id: qrId, restaurantId, tableId, isActive: true }, data: { isActive: false, revokedAt: new Date() } }); }
  listMenu(restaurantId: string) { return prisma.menuCategory.findMany({ where: { restaurantId }, orderBy: { sortOrder: 'asc' }, include: menuInclude }); }
  createCategory(restaurantId: string, input: { name: string; sortOrder: number; translations: { locale: string; name: string }[] }) { return prisma.menuCategory.create({ data: { restaurantId, name: input.name, sortOrder: input.sortOrder, translations: { create: input.translations } } }); }
  async updateCategory(restaurantId: string, id: string, input: { name: string; sortOrder: number; isActive: boolean; translations: { locale: string; name: string }[] }) {
    return prisma.$transaction(async (tx) => { const category = await tx.menuCategory.findFirst({ where: { id, restaurantId } }); if (!category) return null; await tx.menuCategory.update({ where: { id }, data: { name: input.name, sortOrder: input.sortOrder, isActive: input.isActive } }); await this.replaceTranslations(tx, id, input.translations); return tx.menuCategory.findUniqueOrThrow({ where: { id } }); });
  }
  async deleteCategory(restaurantId: string, id: string) { const category = await prisma.menuCategory.findFirst({ where: { id, restaurantId }, include: { _count: { select: { items: true } } } }); if (!category) return null; if (category._count.items) throw new Error('CATEGORY_HAS_ITEMS'); await prisma.menuCategory.delete({ where: { id } }); return category; }
  async saveMenuItem(restaurantId: string, id: string | null, input: MenuItemInput) {
    return prisma.$transaction(async (tx) => {
      const category = await tx.menuCategory.findFirst({ where: { id: input.categoryId, restaurantId } });
      if (!category) throw new Error('CATEGORY_NOT_FOUND');
      const branches = await tx.branch.findMany({ where: { id: { in: input.availableBranchIds }, restaurantId, isActive: true }, select: { id: true } });
      if (branches.length !== new Set(input.availableBranchIds).size) throw new Error('BRANCH_NOT_FOUND');
      const base = { categoryId: input.categoryId, name: input.name, description: input.description, ingredients: input.ingredients, allergens: input.allergens, portionSize: input.portionSize, price: new Prisma.Decimal(input.price), imageUrl: input.imageUrl || null, dietaryLabels: input.dietaryLabels, spiceLevel: input.spiceLevel, isFeatured: input.isFeatured, isActive: input.isActive };
      const item = id ? await tx.menuItem.update({ where: { id, restaurantId }, data: base }) : await tx.menuItem.create({ data: { ...base, restaurantId } });
      await tx.menuItemBranchAvailability.deleteMany({ where: { itemId: item.id } });
      if (input.availableBranchIds.length) await tx.menuItemBranchAvailability.createMany({ data: input.availableBranchIds.map((branchId) => ({ itemId: item.id, restaurantId, branchId, isAvailable: true })) });
      await tx.menuItemTranslation.deleteMany({ where: { itemId: item.id, locale: { notIn: input.translations.map((t) => t.locale) } } });
      for (const translation of input.translations) await tx.menuItemTranslation.upsert({ where: { itemId_locale: { itemId: item.id, locale: translation.locale } }, create: { itemId: item.id, ...translation }, update: { name: translation.name, description: translation.description, ingredients: translation.ingredients, allergens: translation.allergens, portionSize: translation.portionSize } });
      await tx.modifierGroup.deleteMany({ where: { itemId: item.id } });
      for (const [sortOrder, group] of input.modifierGroups.entries()) await tx.modifierGroup.create({ data: { itemId: item.id, name: group.name, isRequired: group.isRequired, minSelections: group.minSelections, maxSelections: group.maxSelections, sortOrder, translations: { create: group.translations }, options: { create: group.options.map((option) => ({ name: option.name, priceDelta: new Prisma.Decimal(option.priceDelta), isAvailable: option.isAvailable, translations: { create: option.translations } })) } } });
      return tx.menuItem.findUniqueOrThrow({ where: { id: item.id }, include: { translations: true, branchAvailability: { include: { branch: { select: { id: true, name: true } } } }, modifierGroups: { include: { translations: true, options: { include: { translations: true } } } } } });
    });
  }
  archiveMenuItem(restaurantId: string, id: string) { return prisma.menuItem.updateMany({ where: { id, restaurantId }, data: { isActive: false } }); }
  private replaceTranslations(tx: Prisma.TransactionClient, id: string, translations: { locale: string; name: string }[]) {
    return tx.menuCategoryTranslation.deleteMany({ where: { categoryId: id, locale: { notIn: translations.map((t) => t.locale) } } }).then(async () => { for (const translation of translations) await tx.menuCategoryTranslation.upsert({ where: { categoryId_locale: { categoryId: id, locale: translation.locale } }, create: { categoryId: id, ...translation }, update: { name: translation.name } }); });
  }
}

export type MenuItemInput = { categoryId: string; name: string; description?: string; ingredients?: string; allergens?: string; portionSize?: string; price: string; imageUrl?: string; dietaryLabels: string[]; spiceLevel: number | null; isFeatured: boolean; isActive: boolean; availableBranchIds: string[]; translations: { locale: string; name: string; description?: string; ingredients?: string; allergens?: string; portionSize?: string }[]; modifierGroups: { name: string; isRequired: boolean; minSelections: number; maxSelections: number; translations: { locale: string; name: string }[]; options: { name: string; priceDelta: string; isAvailable: boolean; translations: { locale: string; name: string }[] }[] }[] };
export const managementRepository = new ManagementRepository();
