import { resolve } from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ['192.168.1.9'],
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN?.replace(/\/$/, '');
    if (!backendOrigin) return [];

    return [{ source: '/api/v1/:path*', destination: `${backendOrigin}/api/v1/:path*` }];
  },
};
export default withNextIntl(nextConfig);
