'use client';
import { useState } from 'react';
import { login, logout } from '../services/auth.service';
import { ApiClientError } from '@/lib/api/client';
export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signIn(email: string, password: string) { setLoading(true); setError(null); try { return await login(email, password); } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'We could not sign you in. Check your details and try again.'); return null; } finally { setLoading(false); } }
  async function signOut() { await logout(); }
  return { loading, error, signIn, signOut };
}
