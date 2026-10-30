import type { UserRole } from '../../../generated/prisma/index.js';
export type AuthResponseDto = {
  user: { id: string; email: string; displayName: string; isPlatformAdmin: boolean };
  memberships: Array<{ restaurantId: string; restaurantName: string; branchId: string | null; branchName: string | null; role: UserRole }>;
};
