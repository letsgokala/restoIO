import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Brand } from '@/components/shared/brand';
import { RestaurantRegistrationForm } from '@/features/auth/components/restaurant-registration-form';

export default async function RegisterPage() {
  const t = await getTranslations('Auth');
  return <main className="login-shell">
    <section className="login-visual" aria-label={t('registerSubtitle')}>
      <Image className="login-photo" src="/images/ethiopian-dinner-placeholder.jpg" alt="" fill priority sizes="(max-width: 700px) 100vw, 48vw"/>
      <div className="login-visual-content"><Brand light/><div className="login-message"><div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true"/>{t('registerEyebrow')}</div><h2 className="display-type">{t('registerVisualTitle')}</h2><p>{t('registerVisualCopy')}</p></div><div className="login-photo-label">{t('registerPhotoLabel')}</div></div>
    </section>
    <section className="login-panel register-panel">
      <div className="login-content">
        <div className="mobile-brand"><Brand/></div>
        <div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true"/>{t('registerOwnerEyebrow')}</div>
        <h1 className="display-type login-title">{t('registerTitle')}</h1>
        <p className="login-subtitle">{t('registerSubtitle')}</p>
        <RestaurantRegistrationForm/>
        <Link className="back-link" href="/">← {t('backToResto')}</Link>
      </div>
    </section>
  </main>;
}
