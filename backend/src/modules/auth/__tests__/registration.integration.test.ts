import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import { prisma } from '../../../config/prisma.js';

const suffix = randomBytes(8).toString('hex');
const email = `new-owner-${suffix}@example.test`;
const password = 'New-Restaurant-Password-123!';
let restaurantId: string | undefined;
let ownerId: string | undefined;

afterAll(async () => {
  if (ownerId) await prisma.staffSession.deleteMany({ where: { userId: ownerId } });
  if (restaurantId) {
    await prisma.membership.deleteMany({ where: { restaurantId } });
    await prisma.branch.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
  }
  if (ownerId) await prisma.user.deleteMany({ where: { id: ownerId } });
});

describe('restaurant owner onboarding without development seed data', () => {
  it('creates the first owner, restaurant, and branch and opens an empty workspace', async () => {
    const created = await request(app).post('/api/v1/auth/register-restaurant').send({
      name: 'Fresh Restaurant', slug: `fresh-restaurant-${suffix}`, currency: 'ETB', timezone: 'Africa/Addis_Ababa',
      branchName: 'Main Branch', branchSlug: 'main-branch', ownerName: 'First Owner', ownerEmail: email, password,
    }).expect(201);
    restaurantId = created.body.restaurant.id;
    const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
    ownerId = owner.id;
    expect(created.body).toMatchObject({ restaurant: { name: 'Fresh Restaurant' }, branch: { name: 'Main Branch' }, owner: { email, displayName: 'First Owner' } });
    expect(owner.isPlatformAdmin).toBe(false);

    const signedIn = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const cookie = (signedIn.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const headers = { Cookie: cookie, 'X-Restaurant-Id': restaurantId };
    await request(app).get('/api/v1/management/restaurants').set('Cookie', cookie).expect(200).expect((response) => expect(response.body.restaurants).toEqual([expect.objectContaining({ id: restaurantId, name: 'Fresh Restaurant' })]));
    await request(app).get('/api/v1/tenant/branches').set(headers).expect(200).expect((response) => expect(response.body).toHaveLength(1));
    await request(app).get('/api/v1/tenant/tables').set(headers).expect(200).expect((response) => expect(response.body).toEqual([]));
    await request(app).get('/api/v1/tenant/menu').set(headers).expect(200).expect((response) => expect(response.body).toEqual([]));
  });

  it('rejects invalid signup data and duplicate owner email addresses', async () => {
    await request(app).post('/api/v1/auth/register-restaurant').send({ name: 'X', password: 'short' }).expect(400);
    await request(app).post('/api/v1/auth/register-restaurant').send({
      name: 'Another Restaurant', slug: `another-restaurant-${suffix}`, currency: 'ETB', timezone: 'Africa/Addis_Ababa',
      branchName: 'Main Branch', branchSlug: 'main-branch', ownerName: 'Second Owner', ownerEmail: email, password,
    }).expect(409);
  });
});
