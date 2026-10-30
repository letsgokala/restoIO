import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
describe('health API', () => {
  it('reports API readiness on the versioned endpoint', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'restoio-api' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });
  it('validates login input before authentication', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' }).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('rejects an unexpected browser origin on state-changing requests', async () => {
    const response = await request(app).post('/api/v1/auth/logout').set('Origin', 'https://attacker.example').expect(403);
    expect(response.body.error.code).toBe('ORIGIN_FORBIDDEN');
  });
});
