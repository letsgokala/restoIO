'use client';
import { useTranslations } from 'next-intl';
const languages = [{ code: 'en', name: 'English' }, { code: 'am', name: '\u12A0\u121B\u122D\u129B' }, { code: 'ar', name: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629' }];
export function LanguageSelector({ locale }: { locale: string }) {
  const t = useTranslations('Customer');
  return <label className="customer-language"><span className="sr-only">{t('language')}</span><select aria-label={t('language')} value={locale} onChange={(e) => { document.cookie = `restoio_locale=${e.target.value}; Path=/; Max-Age=31536000; SameSite=Lax`; window.location.reload(); }}>{languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select></label>;
}
