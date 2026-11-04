import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { GlobalLanguageSelector } from '@/components/shared/global-language-selector';
import './globals.css';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Home');
  return { title: t('metadataTitle'), description: t('metadataDescription') };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const messages = await getMessages();
  const locale = await getLocale();
  return <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}><body><NextIntlClientProvider messages={messages}>{children}<GlobalLanguageSelector /></NextIntlClientProvider></body></html>;
}
