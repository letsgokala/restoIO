import { expect, test } from '@playwright/test';

test('guest scans a table QR, changes language, orders and tracks privately', async ({ page }) => {
  await page.goto('/q/demo-table-01-qr-token-for-local-development-only', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Blue Nile Café' })).toBeVisible();
  await expect(page.getByText('Table 01')).toBeVisible();
  await page.getByRole('button', { name: /Doro wat/ }).click();
  await page.getByRole('dialog').getByLabel('Extra injera').check();
  await page.getByRole('button', { name: /Add to order/ }).click();
  await expect(page.getByRole('button', { name: /1 · Your order/ })).toBeVisible();
  await page.getByLabel('Language').selectOption('am');
  await expect(page.getByRole('heading', { name: 'Blue Nile Café' })).toBeVisible();
  await expect(page.getByText('ጠረጴዛ 01')).toBeVisible();
  await expect(page.getByRole('button', { name: /1 · ትዕዛዝዎ/ })).toBeVisible();
  const language = page.locator('.customer-language select');
  for (const locale of ['en', 'am', 'ar', 'zh', 'tr', 'es', 'de']) {
    await language.selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  }
  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: /1 · Your order/ })).toBeVisible();
  await page.getByRole('button', { name: /1 · Your order/ }).click();
  await page.getByRole('button', { name: 'Review order' }).click();
  await page.getByRole('button', { name: 'Send order to the team' }).click();
  await expect(page.getByRole('heading', { name: 'Order status' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Table 01')).toBeVisible();
  await expect(page.getByText('Waiting for the team to confirm').first()).toBeVisible();
  await expect(page.getByText('Doro wat')).toBeVisible();
});

test('unknown QR tokens receive a clear guest-facing unavailable state', async ({ page }) => {
  await page.goto('/q/this-is-an-invalid-and-unissued-token-xxxxxxxx', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'This table link is unavailable' })).toBeVisible();
  await expect(page.getByText('Please ask a member of the restaurant team for help.')).toBeVisible();
});
