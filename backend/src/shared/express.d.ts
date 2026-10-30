import type { AuthenticatedUser, RestaurantAccess } from '../modules/auth/types/auth.types.js';
declare global { namespace Express { interface Request { requestId: string; auth?: { user: AuthenticatedUser; sessionId: string; restaurantId: string | null }; tenant?: RestaurantAccess } } }
export {};
