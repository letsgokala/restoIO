'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { login, logout } from '../services/auth.service';
export function useAuth() {
  const t = useTranslations('Auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signIn(email: string, password: string) { setLoading(true); setError(null); try { return await login(email, password); } catch { setError(t('failed')); return null; } finally { setLoading(false); } }
  async function signOut() { await logout(); }
  return { loading, error, signIn, signOut };
}
