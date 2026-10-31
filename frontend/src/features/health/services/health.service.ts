import { apiRequest } from '@/lib/api/client';
export type ApiHealth = { status: 'ok'; service: 'restoio-api'; timestamp: string };
export const getApiHealth = (): Promise<ApiHealth> => apiRequest<ApiHealth>('/health');
