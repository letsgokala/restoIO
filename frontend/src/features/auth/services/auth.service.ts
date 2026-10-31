import { apiRequest } from '@/lib/api/client';
import type { AuthResponse } from '../types/auth.types';
export type RestaurantRegistration = { name: string; slug: string; currency: string; timezone: string; branchName: string; branchSlug: string; ownerEmail: string; ownerName: string; password: string };
export const registerRestaurant = (body: RestaurantRegistration) => apiRequest<{ restaurant: { id: string; name: string; slug: string }; branch: { id: string; name: string }; owner: { email: string; displayName: string } }>('/auth/register-restaurant', { method: 'POST', body: JSON.stringify(body) });
export const login = (email: string, password: string): Promise<AuthResponse> => apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const getCurrentUser = (): Promise<{ user: AuthResponse['user']; restaurantId: string | null }> => apiRequest('/auth/me');
export const logout = (): Promise<void> => apiRequest('/auth/logout', { method: 'POST' });
