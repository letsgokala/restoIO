'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getApiHealth } from '../services/health.service';
type Status = 'checking' | 'connected' | 'unavailable';
export function ApiStatus() {
  const t = useTranslations('Home');
  const [status, setStatus] = useState<Status>('checking');
  useEffect(() => {
    let active = true;
    getApiHealth().then(() => { if (active) setStatus('connected'); }).catch(() => { if (active) setStatus('unavailable'); });
    return () => { active = false; };
  }, []);
  return <div className="api-status" aria-live="polite">
    <span className={`api-status-dot api-status-dot--${status}`} aria-hidden="true" />
    {status === 'checking' ? t('healthLoading') : status === 'connected' ? t('healthConnected') : t('healthUnavailable')}
  </div>;
}
