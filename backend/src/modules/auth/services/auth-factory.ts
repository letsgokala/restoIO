import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import { AuthService } from './auth.service.js';
export const authService = new AuthService(new AuthRepository(prisma), env.SESSION_TTL_HOURS);
