import { expect, test } from '@playwright/test';
test('home page connects to the API and offers staff sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good food. Seamless service.' })).toBeVisible();
  await expect(page.getByText('Workspace connected')).toBeVisible({ timeout: 10_000 });
  await page.locator('a[href="/login"]').first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('seeded restaurant owner can open the management workspace', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill('owner@blue-nile.demo.local');
  await page.locator('#login-password').fill(process.env.RESTOIO_E2E_OWNER_PASSWORD ?? 'ChangeMe_OnlyForLocalDev_123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Management sections' })).toBeVisible();
  await page.getByRole('button', { name: 'Tables & QR' }).click();
  await expect(page.getByRole('heading', { name: 'Tables & QR codes' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('heading', { name: 'Menu management' })).toBeVisible();
});
