import { healthResponseSchema } from '../../../shared/contracts.js';
export const getHealth = () => healthResponseSchema.parse({ status: 'ok', service: 'restoio-api', timestamp: new Date().toISOString() });
