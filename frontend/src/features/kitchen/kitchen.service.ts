import { apiRequest } from '../../lib/api/client';
import type { ManagedRestaurant } from '../management/management.service';

export type KitchenItem = { id: string; name: string; quantity: number; customizations: { group?: string; option?: string }[]; specialInstructions: string | null; status: 'PENDING' | 'PREPARING' | 'READY'; preparationStartedAt: string | null; readyAt: string | null; events: { previousStatus: string | null; status: string; createdAt: string }[] };
export type KitchenOrder = { reference: string; status: 'CONFIRMED' | 'PREPARING' | 'READY'; createdAt: string; updatedAt: string; branch: { name: string }; table: { label: string }; items: KitchenItem[] };
export type KitchenQueue = { orders: KitchenOrder[]; changes: { reference: string; table: { label: string }; changedAt: string; note: string }[]; generatedAt: string };
export type KitchenApi = <T>(path: string, init?: RequestInit) => Promise<T>;
export const accessibleKitchenRestaurants = () => apiRequest<{ restaurants: ManagedRestaurant[] }>('/management/restaurants');
