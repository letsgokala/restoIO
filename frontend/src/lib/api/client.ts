const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
export class ApiClientError extends Error { constructor(message: string, readonly status: number) { super(message); this.name = 'ApiClientError'; } }
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string; requestId?: string } } | null;
    const message = payload?.error?.message ?? 'The request failed';
    const requestId = payload?.error?.requestId ?? response.headers.get('X-Request-Id') ?? undefined;
    throw new ApiClientError(requestId ? `${message} (Reference: ${requestId})` : message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const apiUrl = (path: string): string => `${apiBaseUrl}${path}`;
