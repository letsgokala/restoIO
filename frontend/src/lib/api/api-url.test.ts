import { describe, expect, it } from 'vitest';
import { apiUrl } from './client';
describe('apiUrl', () => { it('joins a REST path to the versioned API base', () => { expect(apiUrl('/health')).toMatch(/\/api\/v1\/health$/); }); });
