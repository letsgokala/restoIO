import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Brand } from '@/components/shared/brand';
import { LoginForm } from '@/features/auth/components/login-form';
export default async function LoginPage() {
  const t = await getTranslations('Auth');
  return <main className="login-shell">
    <section className="login-visual" aria-label={t('visualDescription')}>
      <Image className="login-photo" src="/images/ethiopian-dinner-placeholder.jpg" alt="" fill priority sizes="(max-width: 700px) 100vw, 48vw" />
      <div className="login-visual-content">
        <Brand light />
        <div className="login-message">
          <div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" />{t('visualEyebrow')}</div>
          <h2 className="display-type">{t('visualTitle')}</h2>
          <p>{t('visualDescription')}</p>
        </div>
      </div>
    </section>
    <section className="login-panel">
      <div className="login-content">
        <div className="mobile-brand"><Brand /></div>
        <div className="eyebrow"><span className="eyebrow-mark" aria-hidden="true" />{t('workspace')}</div>
        <h1 className="display-type login-title">{t('title')}</h1>
        <p className="login-subtitle">{t('subtitle')}</p>
        <LoginForm />
        <p className="login-footnote">{t('accessNote')}</p>
        <p className="login-footnote">{t('newToResto')} <Link href="/register">{t('createAccount')}</Link></p>
        <Link className="back-link" href="/">← {t('backToResto')}</Link>
      </div>
    </section>
  </main>;
}
