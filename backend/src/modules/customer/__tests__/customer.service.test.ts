import { randomBytes, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import { prisma } from '../../../config/prisma.js';
import { CustomerService } from '../customer.service.js';

const service = new CustomerService();
const rawQr = randomBytes(32).toString('base64url');
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
const suffix = randomBytes(8).toString('hex');
let restaurantId = ''; let branchId = ''; let tableId = ''; let categoryId = ''; let itemId = ''; let groupId = ''; let optionId = ''; let qrId = ''; let orderReference = ''; let firstSessionId = '';

beforeAll(async () => {
  const restaurant = await prisma.restaurant.create({ data: { name: 'Customer Test', description: 'Test restaurant introduction', slug: `customer-test-${suffix}` } }); restaurantId = restaurant.id;
  const branch = await prisma.branch.create({ data: { restaurantId, name: 'Test branch', slug: 'test' } }); branchId = branch.id;
  const table = await prisma.diningTable.create({ data: { restaurantId, branchId, label: 'T1' } }); tableId = table.id;
  const qr = await prisma.qRToken.create({ data: { restaurantId, branchId, tableId, tokenHash: digest(rawQr) } }); qrId = qr.id;
  const category = await prisma.menuCategory.create({ data: { restaurantId, name: 'Test menu' } }); categoryId = category.id;
  const item = await prisma.menuItem.create({ data: { restaurantId, categoryId, name: 'Test plate', description: 'Fresh plate', ingredients: 'Rice', allergens: 'None', price: '100.25' } }); itemId = item.id;
  await prisma.menuItemBranchAvailability.create({ data: { itemId, restaurantId, branchId } });
  const group = await prisma.modifierGroup.create({ data: { itemId, name: 'Sauce', isRequired: true, minSelections: 1, maxSelections: 1 } }); groupId = group.id;
  const option = await prisma.modifierOption.create({ data: { groupId, name: 'Extra sauce', priceDelta: '10.50' } }); optionId = option.id;
});

afterAll(async () => {
  if (restaurantId) {
    await prisma.assistanceRequest.deleteMany({ where: { restaurantId } });
    await prisma.customerOrder.deleteMany({ where: { restaurantId } });
    await prisma.tableSession.deleteMany({ where: { restaurantId } });
    await prisma.menuItemBranchAvailability.deleteMany({ where: { branchId } });
    await prisma.modifierGroup.deleteMany({ where: { itemId } });
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
    await prisma.menuCategory.deleteMany({ where: { restaurantId } });
    await prisma.qRToken.deleteMany({ where: { id: qrId } });
    await prisma.diningTable.deleteMany({ where: { id: tableId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
  }
});

describe('anonymous customer ordering domain', () => {
  it('does not authorize order tracking by reference alone or allow anonymous staff status changes', async () => {
    const reference = `R-${randomBytes(8).toString('hex').toUpperCase()}`;
    await request(app).get(`/api/v1/customer/orders/${reference}`).expect(404);
    await request(app).patch(`/api/v1/tenant/orders/${reference}/status`).send({ status: 'CONFIRMED' }).expect(401);
  });
  it('validates anonymous checkout input and ignores guest-supplied prices', async () => {
    const item = await prisma.menuItem.findUniqueOrThrow({ where: { id: itemId } });
    const group = await prisma.modifierGroup.findUniqueOrThrow({ where: { id: groupId } });
    const option = await prisma.modifierOption.findUniqueOrThrow({ where: { id: optionId } });
    const guestToken = randomBytes(32).toString('base64url');
    const invalid = await request(app).post(`/api/v1/customer/qr/${rawQr}/orders`).set('X-Guest-Order-Token', guestToken).set('Idempotency-Key', `invalid-${randomBytes(16).toString('hex')}`).send({ items: [{ itemId: item.publicId, quantity: 0, modifiers: [] }] }).expect(400);
    expect(invalid.body.error.code).toBeTruthy();
    const priced = await request(app).post(`/api/v1/customer/qr/${rawQr}/orders`).set('X-Guest-Order-Token', guestToken).set('Idempotency-Key', `priced-${randomBytes(16).toString('hex')}`).send({ items: [{ itemId: item.publicId, quantity: 1, price: '0.01', modifiers: [{ groupId: group.publicId, optionIds: [option.publicId] }] }] }).expect(201);
    expect(priced.body).toMatchObject({ total: '110.75', paymentStatus: 'UNPAID', status: 'PENDING_CONFIRMATION' });
    expect(priced.body.items[0]).toMatchObject({ unitPrice: '110.75', customizations: [{ option: 'Extra sauce' }] });
  });
  it('resolves valid QR to its restaurant, branch and table without exposing database ids', async () => {
    const context = await service.resolveQr(rawQr);
    expect(context).toMatchObject({ restaurant: { name: 'Customer Test', description: 'Test restaurant introduction' }, branch: { name: 'Test branch' }, table: { label: 'T1' } });
    expect(JSON.stringify(context)).not.toContain(restaurantId);
    await expect(service.resolveQr('unknown-qr-token-that-is-definitely-not-valid')).rejects.toMatchObject({ code: 'QR_UNAVAILABLE' });
  });
  it('rejects disabled QR codes and returns only branch available translated menu with English fallback', async () => {
    await prisma.menuItemTranslation.create({ data: { itemId, locale: 'am', name: 'የሙከራ ምግብ' } });
    const menu = await service.getMenu(rawQr, 'am');
    expect(menu.categories[0]?.items[0]).toMatchObject({ name: 'የሙከራ ምግብ', ingredients: 'Rice', allergens: 'None', available: true });
    const otherBranch = await prisma.branch.create({ data: { restaurantId, name: 'Other branch', slug: 'other' } });
    const otherTable = await prisma.diningTable.create({ data: { restaurantId, branchId: otherBranch.id, label: 'T2' } });
    const otherToken = randomBytes(32).toString('base64url');
    await prisma.qRToken.create({ data: { restaurantId, branchId: otherBranch.id, tableId: otherTable.id, tokenHash: digest(otherToken) } });
    expect((await service.getMenu(otherToken, 'en')).categories[0]?.items).toMatchObject([{ name: 'Test plate', available: false }]);
    expect(otherBranch.id).not.toBe(branchId);
    await prisma.qRToken.update({ where: { id: qrId }, data: { isActive: false } });
    await expect(service.getMenu(rawQr, 'en')).rejects.toMatchObject({ code: 'QR_UNAVAILABLE' });
    await prisma.qRToken.update({ where: { id: qrId }, data: { isActive: true } });
    await prisma.qRToken.update({ where: { id: qrId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(service.resolveQr(rawQr)).rejects.toMatchObject({ code: 'QR_UNAVAILABLE' });
    await prisma.qRToken.update({ where: { id: qrId }, data: { expiresAt: null } });
    await prisma.qRToken.deleteMany({ where: { tableId: otherTable.id } });
    await prisma.diningTable.delete({ where: { id: otherTable.id } });
    await prisma.branch.delete({ where: { id: otherBranch.id } });
  });
  it('server prices modifiers, reuses the table session, makes separate guest orders and protects tracking', async () => {
    const guest = randomBytes(32).toString('base64url');
    const key1 = `test-${randomBytes(18).toString('hex')}`;
    const line = { itemId: (await prisma.menuItem.findUniqueOrThrow({ where: { id: itemId } })).publicId, quantity: 2, modifiers: [{ groupId: (await prisma.modifierGroup.findUniqueOrThrow({ where: { id: groupId } })).publicId, optionIds: [(await prisma.modifierOption.findUniqueOrThrow({ where: { id: optionId } })).publicId] }] };
    await expect(service.placeOrder(rawQr, `test-${randomBytes(18).toString('hex')}`, guest, { items: [{ ...line, modifiers: [] }] })).rejects.toMatchObject({ code: 'INVALID_MODIFIERS' });
    const [first, concurrentRetry] = await Promise.all([service.placeOrder(rawQr, key1, guest, { items: [line] }), service.placeOrder(rawQr, key1, guest, { items: [line] })]); orderReference = first.order.reference;
    expect(first.order.total).toBe('221.5');
    expect(concurrentRetry.order.reference).toBe(first.order.reference);
    const retried = await service.placeOrder(rawQr, key1, guest, { items: [line] });
    expect(retried.order.reference).toBe(first.order.reference);
    await expect(service.placeOrder(rawQr, key1, randomBytes(32).toString('base64url'), { items: [line] })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const [second, third] = await Promise.all([service.placeOrder(rawQr, `test-${randomBytes(18).toString('hex')}`, randomBytes(32).toString('base64url'), { items: [line] }), service.placeOrder(rawQr, `test-${randomBytes(18).toString('hex')}`, randomBytes(32).toString('base64url'), { items: [line] })]);
    const dbOrders = await prisma.customerOrder.findMany({ where: { reference: { in: [first.order.reference, second.order.reference, third.order.reference] } } });
    expect(dbOrders).toHaveLength(3); expect(new Set(dbOrders.map((o) => o.tableSessionId)).size).toBe(1); firstSessionId = dbOrders[0]!.tableSessionId;
    expect(await service.trackOrder(first.order.reference, guest)).toMatchObject({ reference: first.order.reference, status: 'PENDING_CONFIRMATION' });
    await expect(service.trackOrder(first.order.reference, randomBytes(32).toString('base64url'))).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    await expect(service.updateStatus(first.order.reference, 'CONFIRMED', 'another-tenant')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    await expect(service.updateStatus(first.order.reference, 'CONFIRMED', restaurantId, 'other-branch')).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    expect((await service.updateStatus(first.order.reference, 'CONFIRMED', restaurantId)).status).toBe('CONFIRMED');
    await prisma.customerOrder.update({ where: { reference: first.order.reference }, data: { guestTokenExpiresAt: new Date(Date.now() - 1000) } });
    await expect(service.trackOrder(first.order.reference, guest)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
  });
  it('creates assistance requests from the same table context and limits repeated requests', async () => {
    const first = await service.requestAssistance(rawQr, 'WAITER');
    expect(first).toMatchObject({ accepted: true, status: 'OPEN', reference: expect.any(String), accessToken: expect.any(String) });
    await service.requestAssistance(rawQr, 'WAITER'); await service.requestAssistance(rawQr, 'WAITER');
    await expect(service.requestAssistance(rawQr, 'WAITER')).rejects.toMatchObject({ status: 429, code: 'ASSISTANCE_RATE_LIMIT' });
    await expect(service.trackAssistance(first.reference, randomBytes(32).toString('base64url'))).rejects.toMatchObject({ code: 'ASSISTANCE_NOT_FOUND' });
    expect(await service.trackAssistance(first.reference, first.accessToken)).toMatchObject({ reference: first.reference, status: 'OPEN', table: { label: 'T1' } });
    await prisma.assistanceRequest.update({ where: { reference: first.reference }, data: { guestTokenExpiresAt: new Date(Date.now() - 1000) } });
    await expect(service.trackAssistance(first.reference, first.accessToken)).rejects.toMatchObject({ code: 'ASSISTANCE_NOT_FOUND' });
  });
});
