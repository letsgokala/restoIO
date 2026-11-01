'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
const languages = [{ code: 'en', name: 'English' }, { code: 'am', name: 'አማርኛ' }, { code: 'ar', name: 'العربية' }, { code: 'zh', name: '中文' }, { code: 'tr', name: 'Türkçe' }, { code: 'es', name: 'Español' }, { code: 'de', name: 'Deutsch' }];
export function LanguageSelector({ locale }: { locale: string }) {
  const router = useRouter(); const t = useTranslations('Customer');
  return <label className="customer-language"><span className="sr-only">{t('language')}</span><select aria-label={t('language')} value={locale} onChange={(e) => { document.cookie = `restoio_locale=${e.target.value}; Path=/; Max-Age=31536000; SameSite=Lax`; router.refresh(); }}>{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label>;
}
