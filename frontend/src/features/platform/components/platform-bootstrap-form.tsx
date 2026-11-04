'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';

export function PlatformBootstrapForm() {
  const router = useRouter();
  const t = useTranslations('App');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ notificationSent: boolean }>('/auth/bootstrap-platform-admin', { method: 'POST', body: JSON.stringify({ token: values.get('token'), email: values.get('email'), displayName: values.get('displayName'), password: values.get('password') }) });
      setNotificationSent(result.notificationSent);
      setCreated(true);
      setTimeout(() => router.push('/login'), 1800);
    } catch (cause) {
      setError(t('platformAdminFailed'));
    } finally {
      setBusy(false);
    }
  };
  if (created) return <section role="status"><p>{t('bootstrapSuccess')} {notificationSent ? t('confirmationEmailSent') : t('emailDeliveryUnavailable')} {t('signInDashboard')}</p><Button onClick={() => router.push('/login')}>{t('goToSignIn')}</Button></section>;
  return <form onSubmit={submit} className="login-form">
    <label className="form-label" htmlFor="bootstrap-token">{t('setupToken')}<input id="bootstrap-token" name="token" type="password" autoComplete="off" required minLength={32} className="form-input"/></label>
    <label className="form-label" htmlFor="admin-name">{t('yourName')}<input id="admin-name" name="displayName" autoComplete="name" required minLength={2} maxLength={120} className="form-input"/></label>
    <label className="form-label" htmlFor="admin-email">{t('adminEmail')}<input id="admin-email" name="email" type="email" autoComplete="email" required className="form-input"/></label>
    <label className="form-label" htmlFor="admin-password">{t('password')}<input id="admin-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="form-input"/></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <Button className="button--full" disabled={busy}>{busy ? t('creatingAdministrator') : t('createAdministrator')}</Button>
  </form>;
}
