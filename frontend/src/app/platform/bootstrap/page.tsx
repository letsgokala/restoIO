import { PlatformBootstrapForm } from '@/features/platform/components/platform-bootstrap-form';
import { getTranslations } from 'next-intl/server';

export default async function PlatformBootstrapPage() {
  const t = await getTranslations('App');
  return <main className="login-shell"><section className="login-panel register-panel"><div className="login-content"><div className="eyebrow">{t('oneTimePlatformSetup')}</div><h1 className="display-type login-title">{t('createPlatformAdmin')}</h1><p className="login-subtitle">{t('bootstrapDescription')}</p><PlatformBootstrapForm/></div></section></main>;
}
