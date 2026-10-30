import type { UserRole } from '../../../generated/prisma/index.js';
export type AuthenticatedUser = { id: string; email: string; displayName: string; isPlatformAdmin: boolean };
export type RestaurantAccess = { restaurantId: string; branchId: string | null; role: UserRole };
