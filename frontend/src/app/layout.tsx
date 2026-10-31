import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
export const metadata: Metadata = { title: 'RestoIO | Good food. Seamless service.', description: 'A thoughtful restaurant workspace, designed for Ethiopia.' };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const messages = await getMessages();
  const locale = await getLocale();
  return <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}><body><NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider></body></html>;
}
