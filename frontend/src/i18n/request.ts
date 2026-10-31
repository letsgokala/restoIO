import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
const supported = ['am', 'en', 'ar', 'zh', 'tr', 'es', 'de'] as const;
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const saved = (await cookies()).get('restoio_locale')?.value;
  const locale = supported.includes(saved as (typeof supported)[number]) ? saved! : supported.includes(requested as (typeof supported)[number]) ? requested! : 'en';
  const base = (await import('../../messages/en.json')).default;
  const localized = locale === 'en' ? base : (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages: { ...base, ...localized, Home: { ...base.Home, ...localized.Home }, Auth: { ...base.Auth, ...localized.Auth }, Customer: { ...base.Customer, ...localized.Customer } } };
});
