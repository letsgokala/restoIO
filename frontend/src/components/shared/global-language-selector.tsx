'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'am', name: '\u12A0\u121B\u122D\u129B' },
  { code: 'ar', name: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629' },
];

export function GlobalLanguageSelector() {
  const locale = useLocale();
  const t = useTranslations('App');
  const pathname = usePathname();

  if (pathname.startsWith('/q/') || pathname.startsWith('/orders/')) return null;

  return <label className="global-language-selector">
    <span aria-hidden="true">Aa</span>
    <select
      aria-label={t('selectLanguage')}
      value={locale}
      onChange={(event) => {
        document.cookie = `restoio_locale=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax`;
        window.location.reload();
      }}
    >
      {languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
    </select>
  </label>;
}
