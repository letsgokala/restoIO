import { expect, test, type Browser, type Page } from '@playwright/test';

const qrPath = '/q/demo-table-01-qr-token-for-local-development-only';
const password = process.env.RESTOIO_E2E_OWNER_PASSWORD ?? 'ChangeMe_OnlyForLocalDev_123!';

async function login(browser: Browser, email: string, path: '/waiter' | '/kitchen') {
  const context = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  return { context, page };
}

test('waiter acceptance, kitchen item readiness, and guest status stay synchronized', async ({ browser }) => {
  test.setTimeout(90_000);
  const guestContext = await browser.newContext({ baseURL: 'http://localhost:3000' });
  const guest = await guestContext.newPage();
  await guest.goto(qrPath, { waitUntil: 'domcontentloaded' });
  await expect(guest.getByRole('heading', { name: 'Blue Nile Café' })).toBeVisible();

  for (const instruction of ['First plate', 'Second plate']) {
    await guest.getByRole('button', { name: /Doro wat/ }).click();
    await guest.getByRole('dialog').getByLabel('Special instructions').fill(instruction);
    await guest.getByRole('button', { name: /Add to order/ }).click();
  }
  await guest.getByRole('button', { name: /2 · Your order/ }).click();
  await guest.getByRole('button', { name: 'Review order' }).click();
  const responsePromise = guest.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/customer/qr/') && response.url().endsWith('/orders'));
  await guest.getByRole('button', { name: 'Send order to the team' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const order = await response.json() as { reference: string };
  await expect(guest.getByRole('heading', { name: 'Order status' })).toBeVisible();

  const waiter = await login(browser, 'waiter@blue-nile.demo.local', '/waiter');
  await expect(waiter.page.getByRole('heading', { name: 'Order desk' })).toBeVisible({ timeout: 15_000 });
  const waiterSearch = waiter.page.getByRole('textbox', { name: 'Search order or table' });
  await waiterSearch.fill(order.reference);
  await expect(waiter.page.getByText(order.reference).first()).toBeVisible({ timeout: 15_000 });
  await waiter.page.getByRole('button', { name: 'Review order' }).click();
  await waiter.page.getByRole('dialog').getByRole('button', { name: 'Accept order' }).click();

  const kitchen = await login(browser, 'kitchen@blue-nile.demo.local', '/kitchen');
  await expect(kitchen.page.getByRole('heading', { name: 'Kitchen display' })).toBeVisible({ timeout: 15_000 });
  const kitchenSearch = kitchen.page.getByRole('textbox', { name: 'Search kitchen tickets' });
  await kitchenSearch.fill(order.reference);
  await expect(kitchen.page.getByText(order.reference.slice(-6))).toBeVisible({ timeout: 15_000 });
  const ticket = kitchen.page.locator('.kitchen-ticket').filter({ hasText: order.reference.slice(-6) });
  await expect(ticket.getByRole('button', { name: 'Start preparation' })).toBeVisible();
  await ticket.getByRole('button', { name: 'Start preparation' }).click();
  await expect(ticket.getByText('PREPARING', { exact: true })).toBeVisible();
  await expect(guest.getByText('Being prepared in the kitchen', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(waiter.page.getByText('Preparing', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  const readyButtons = ticket.getByRole('button', { name: 'Mark ready' });
  await expect(readyButtons).toHaveCount(2);
  await readyButtons.nth(0).click();
  await expect(ticket.getByText('1/2 items ready')).toBeVisible();
  await expect(ticket.getByText('PREPARING', { exact: true })).toBeVisible();
  await expect(guest.getByText('Being prepared in the kitchen', { exact: true }).first()).toBeVisible();
  await expect(ticket.getByRole('button', { name: 'Mark remaining ready' })).toBeVisible();
  await ticket.getByRole('button', { name: 'Mark remaining ready' }).click();
  await expect(ticket.getByText('READY', { exact: true })).toBeVisible();
  await expect(guest.getByText('Ready to be served', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  await waiter.page.getByRole('button', { name: 'Orders' }).click();
  await waiterSearch.fill(order.reference);
  await expect(waiter.page.getByRole('button', { name: 'Mark served' })).toBeVisible({ timeout: 15_000 });
  await waiter.page.getByRole('button', { name: 'Mark served' }).click();
  await expect(guest.getByText('Served at your table', { exact: true })).toBeVisible({ timeout: 15_000 });

  await kitchen.context.close();
  await waiter.context.close();
  await guestContext.close();
});
