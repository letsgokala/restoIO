import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AssistanceKind, OrderStatus, Prisma } from '../../generated/prisma/index.js';
import { AppError } from '../../shared/errors/app-error.js';
import { customerRepository } from './repositories/customer.repository.js';
import { waiterService } from '../waiter/services/waiter.service.js';

const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const orderInclude = { items: true, events: { orderBy: { createdAt: 'asc' as const } }, table: { select: { label: true } } };
type CustomerOrderWithPublicFields = Prisma.CustomerOrderGetPayload<{ include: typeof orderInclude }>;
const publicOrder = (o: CustomerOrderWithPublicFields) => ({ reference: o.reference, status: o.status, paymentStatus: o.paymentStatus, currency: o.currency, subtotal: o.subtotal.toString(), total: o.total.toString(), note: o.note, table: o.table.label, createdAt: o.createdAt, items: o.items.map((i) => ({ name: i.nameSnapshot, unitPrice: i.unitPrice.toString(), quantity: i.quantity, lineTotal: i.lineTotal.toString(), customizations: i.customizations, specialInstructions: i.specialInstructions })), events: o.events.map((e) => ({ previousStatus: e.previousStatus, status: e.status, note: e.note, createdAt: e.createdAt })) });

export class CustomerService {
  async resolveQr(token: string) {
    const qr = await customerRepository.findQr(hash(token));
    if (!qr || !qr.isActive || qr.revokedAt || (qr.expiresAt && qr.expiresAt <= new Date()) || !qr.table.isActive || !qr.table.branch.isActive || qr.table.branch.restaurant.status !== 'ACTIVE') throw new AppError(404, 'QR_UNAVAILABLE', 'This table QR code is invalid or unavailable');
    const branch = qr.table.branch;
    const { restaurant } = branch;
    return { restaurant: { name: restaurant.name, description: restaurant.description, logoUrl: restaurant.logoUrl, coverImageUrl: restaurant.coverImageUrl, slug: restaurant.slug, currency: restaurant.currency }, branch: { name: branch.name }, table: { label: qr.table.label } };
  }
  async getMenu(token: string, locale: string) {
    const context = await this.resolveQr(token);
    const qr = await customerRepository.findQrBranch(hash(token));
    const categories = await customerRepository.findMenu(context.restaurant.slug, qr.branchId, locale);
    return { ...context, categories: categories.map((c) => ({ id: c.publicId, name: c.translations[0]?.name ?? c.name, items: c.items.map((i) => { const t = i.translations[0]; return { id: i.publicId, name: t?.name ?? i.name, description: t?.description ?? i.description, ingredients: t?.ingredients ?? i.ingredients, allergens: t?.allergens ?? i.allergens, portionSize: t?.portionSize ?? i.portionSize, price: i.price.toString(), imageUrl: i.imageUrl, available: i.branchAvailability.some((availability) => availability.isAvailable), dietaryLabels: i.dietaryLabels, spiceLevel: i.spiceLevel, featured: i.isFeatured, modifiers: i.modifierGroups.map((g) => ({ id: g.publicId, name: g.translations[0]?.name ?? g.name, required: g.isRequired, min: g.minSelections, max: g.maxSelections, options: g.options.map((o) => ({ id: o.publicId, name: o.translations[0]?.name ?? o.name, priceDelta: o.priceDelta.toString() })) })) }; }) })) };
  }
  async placeOrder(token: string, idempotencyKey: string, guestToken: string, input: { note?: string; items: { itemId: string; quantity: number; modifiers: { groupId: string; optionIds: string[] }[]; instructions?: string }[] }) {
    const qrHash = hash(token);
    const qr = await customerRepository.findQr(qrHash);
    if (!qr || !qr.isActive || qr.revokedAt || (qr.expiresAt && qr.expiresAt <= new Date()) || !qr.table.isActive || !qr.table.branch.isActive || qr.table.branch.restaurant.status !== 'ACTIVE') throw new AppError(409, 'TABLE_UNAVAILABLE', 'This table cannot accept orders right now');
    const guestHash = hash(guestToken);
    const prior = await customerRepository.findOrderByKey(idempotencyKey);
    if (prior) { if (prior.guestTokenHash !== guestHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This checkout key has already been used'); return { order: publicOrder(prior), accessToken: guestToken, expiresAt: prior.guestTokenExpiresAt }; }
    const itemIds = [...new Set(input.items.map((i) => i.itemId))];
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600000);
    try {
      const order = await customerRepository.createOrder({ qrHash, restaurantId: qr.restaurantId, branchId: qr.branchId, tableId: qr.tableId, currency: qr.table.branch.restaurant.currency, note: input.note, idempotencyKey, guestTokenHash: guestHash, guestTokenExpiresAt: expiresAt, itemPublicIds: itemIds, calculate: (items) => {
        if (items.length !== itemIds.length) throw new AppError(409, 'ITEM_UNAVAILABLE', 'One or more selected items are no longer available');
        let subtotal = new Prisma.Decimal(0);
        const lines = input.items.map((line) => {
          const item = items.find((v) => v.publicId === line.itemId)!;
          const customizations: { group: string; option: string; priceDelta: string }[] = [];
          let unitPrice = item.price;
          for (const group of item.modifierGroups) {
            const selected = line.modifiers.find((m) => m.groupId === group.publicId)?.optionIds ?? [];
            if (selected.length < group.minSelections || selected.length > group.maxSelections || (group.isRequired && !selected.length)) throw new AppError(400, 'INVALID_MODIFIERS', `Choose valid options for ${group.name}`);
            if (new Set(selected).size !== selected.length) throw new AppError(400, 'INVALID_MODIFIERS', 'Duplicate modifier options are not allowed');
            for (const optionId of selected) { const option = group.options.find((o) => o.publicId === optionId); if (!option) throw new AppError(400, 'INVALID_MODIFIERS', `An option for ${group.name} is unavailable`); unitPrice = unitPrice.add(option.priceDelta); customizations.push({ group: group.name, option: option.name, priceDelta: option.priceDelta.toString() }); }
          }
          if (line.modifiers.some((m) => !item.modifierGroups.some((g) => g.publicId === m.groupId))) throw new AppError(400, 'INVALID_MODIFIERS', 'An unknown modifier group was selected');
          const lineTotal = unitPrice.mul(line.quantity); subtotal = subtotal.add(lineTotal);
          return { menuItemId: item.id, nameSnapshot: item.name, unitPrice, quantity: line.quantity, lineTotal, customizations: customizations as Prisma.InputJsonValue, specialInstructions: line.instructions };
        });
        return { subtotal, lines };
      } });
      return { order: publicOrder(order), accessToken: guestToken, expiresAt };
    } catch (error) {
      if (error instanceof Error && error.message === 'CHECKOUT_TABLE_UNAVAILABLE') throw new AppError(409, 'TABLE_UNAVAILABLE', 'This table cannot accept orders right now');
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
        const found = await customerRepository.findOrderByKey(idempotencyKey);
        if (found?.guestTokenHash === guestHash) return { order: publicOrder(found), accessToken: guestToken, expiresAt: found.guestTokenExpiresAt };
        throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'This checkout key has already been used');
      }
      throw error;
    }
  }
  async trackOrder(reference: string, guestToken: string) {
    const order = await customerRepository.findOrder(reference);
    if (!order || order.guestTokenExpiresAt < new Date() || order.guestTokenHash !== hash(guestToken)) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    return publicOrder(order);
  }
  async updateStatus(reference: string, status: OrderStatus, restaurantId: string, branchId: string | null = null) {
    const updated = await waiterService.transitionOrder(reference, status, restaurantId, branchId, 'RESTAURANT_OWNER', null);
    return publicOrder(updated);
  }
  async requestAssistance(token: string, kind: AssistanceKind) {
    const qr = await customerRepository.findQr(hash(token));
    if (!qr || !qr.isActive || qr.revokedAt || (qr.expiresAt && qr.expiresAt <= new Date()) || !qr.table.isActive || !qr.table.branch.isActive || qr.table.branch.restaurant.status !== 'ACTIVE') throw new AppError(409, 'TABLE_UNAVAILABLE', 'This table cannot request assistance right now');
    const since = new Date(Date.now() - 10 * 60_000);
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
    const result = await customerRepository.createAssistanceWithinLimit({ restaurantId: qr.restaurantId, branchId: qr.branchId, tableId: qr.tableId, kind, since, reference: randomUUID(), guestTokenHash: hash(accessToken), guestTokenExpiresAt: expiresAt });
    if (result.rateLimited || !result.request) throw new AppError(429, 'ASSISTANCE_RATE_LIMIT', 'Please wait a few minutes before requesting again');
    return { accepted: true, reference: result.request.reference!, accessToken, expiresAt, status: result.request.status };
  }
  async trackAssistance(reference: string, accessToken: string) {
    const request = await customerRepository.findGuestAssistance(reference, hash(accessToken));
    if (!request) throw new AppError(404, 'ASSISTANCE_NOT_FOUND', 'Assistance request not found');
    return request;
  }
}
export const customerService = new CustomerService();
