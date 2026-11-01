'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ApiClientError, apiRequest } from '@/lib/api/client';

export function PlatformBootstrapForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      await apiRequest('/auth/bootstrap-platform-admin', { method: 'POST', body: JSON.stringify({ token: values.get('token'), email: values.get('email'), displayName: values.get('displayName'), password: values.get('password') }) });
      setCreated(true);
      setTimeout(() => router.push('/login'), 1800);
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Could not create the platform administrator.');
    } finally {
      setBusy(false);
    }
  };
  if (created) return <section role="status"><p>Platform administrator created. Sign in to open the platform dashboard.</p><Button onClick={() => router.push('/login')}>Go to sign in</Button></section>;
  return <form onSubmit={submit} className="login-form">
    <label className="form-label" htmlFor="bootstrap-token">One-time setup token<input id="bootstrap-token" name="token" type="password" autoComplete="off" required minLength={32} className="form-input"/></label>
    <label className="form-label" htmlFor="admin-name">Your name<input id="admin-name" name="displayName" autoComplete="name" required minLength={2} maxLength={120} className="form-input"/></label>
    <label className="form-label" htmlFor="admin-email">Admin email<input id="admin-email" name="email" type="email" autoComplete="email" required className="form-input"/></label>
    <label className="form-label" htmlFor="admin-password">Password<input id="admin-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="form-input"/></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <Button className="button--full" disabled={busy}>{busy ? 'Creating administrator…' : 'Create platform administrator'}</Button>
  </form>;
}
