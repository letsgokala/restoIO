import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';

let backendEnv = '';
try { backendEnv = readFileSync('../backend/.env', 'utf8'); } catch { /* CI can provide the seed secret through the environment. */ }
for (const [key, target] of [['SEED_ADMIN_PASSWORD', 'RESTOIO_E2E_OWNER_PASSWORD']] as const) {
  const value = process.env[key] ?? backendEnv.split(/\r?\n/).find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
  if (value) process.env[target] = value;
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', browserName: 'chromium', headless: true, launchOptions: process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {} },
  webServer: [
    { command: 'npm run dev --prefix ../backend', url: 'http://localhost:4000/api/v1/health', reuseExistingServer: !process.env.CI, timeout: 120_000 },
    { command: 'npm run dev -- --hostname localhost', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
