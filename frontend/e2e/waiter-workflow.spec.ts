import { expect, test, request as playwrightRequest, type Page } from '@playwright/test';

const apiBase = 'http://localhost:4000';
const password = process.env.RESTOIO_E2E_OWNER_PASSWORD ?? 'ChangeMe_OnlyForLocalDev_123!';

async function createE2eTable() {
  const ownerApi = await playwrightRequest.newContext({ baseURL: apiBase });
  try {
    const login = await ownerApi.post('/api/v1/auth/login', { data: { email: 'owner@blue-nile.demo.local', password } });
    expect(login.ok()).toBeTruthy();
    const accessResponse = await ownerApi.get('/api/v1/management/restaurants');
    expect(accessResponse.ok()).toBeTruthy();
    const access = await accessResponse.json() as { restaurants: { id: string; branches: { id: string; isActive?: boolean }[] }[] };
    const restaurant = access.restaurants.find((entry) => entry.branches.length > 0);
    expect(restaurant).toBeTruthy();
    const branch = restaurant!.branches.find((entry) => entry.isActive !== false) ?? restaurant!.branches[0]!;
    const tableLabel = `E2E${Date.now().toString().slice(-8)}`;
    const headers = { 'X-Restaurant-Id': restaurant!.id, 'X-Branch-Id': branch.id };
    const tableResponse = await ownerApi.post('/api/v1/tenant/tables', { headers, data: { branchId: branch.id, label: tableLabel } });
    expect(tableResponse.ok()).toBeTruthy();
    const table = await tableResponse.json() as { id: string };
    const qrResponse = await ownerApi.post(`/api/v1/tenant/tables/${table.id}/qr`, { headers, data: {} });
    expect(qrResponse.ok()).toBeTruthy();
    const qr = await qrResponse.json() as { path: string };
    return { tableLabel, qrPath: qr.path, headers };
  } finally {
    await ownerApi.dispose();
  }
}

async function submitDemoOrder(page: Page, qrPath: string) {
  await page.goto(qrPath, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Doro wat/ }).click();
  await page.getByRole('dialog').getByLabel('Extra injera').check();
  await page.getByRole('dialog').getByLabel('Special instructions').fill('Please keep the sauce separate');
  await page.getByRole('button', { name: /Add to order/ }).click();
  await page.getByRole('button', { name: /1 · Your order/ }).click();
  await page.getByRole('button', { name: 'Review order' }).click();
  await page.getByLabel('Note for the restaurant (optional)').fill('A note from our table');
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/customer/qr/') && response.url().endsWith('/orders'));
  await page.getByRole('button', { name: 'Send order to the team' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const order = await response.json() as { reference: string; paymentStatus: string; note: string; total: string; items: { specialInstructions: string; customizations: { option: string }[] }[] };
  expect(order).toMatchObject({ paymentStatus: 'UNPAID', note: 'A note from our table', total: '505', items: [{ specialInstructions: 'Please keep the sauce separate', customizations: [expect.objectContaining({ option: 'Extra injera' })] }] });
  await expect(page.getByRole('heading', { name: 'Order status' })).toBeVisible();
  return order.reference;
}

test('guest order reaches the assigned waiter and can be served after kitchen preparation', async ({ page }) => {
  test.setTimeout(120_000);
  const { tableLabel, qrPath, headers: tenantHeaders } = await createE2eTable();
  const reference = await submitDemoOrder(page, qrPath);
  const secondGuestContext = await page.context().browser()!.newContext({ baseURL: 'http://localhost:3000' });
  const secondGuestPage = await secondGuestContext.newPage();
  const secondReference = await submitDemoOrder(secondGuestPage, qrPath);
  expect(secondReference).not.toBe(reference);

  const waiterPage = await page.context().newPage();
  await waiterPage.goto('/login');
  await waiterPage.locator('#login-email').fill('waiter@blue-nile.demo.local');
  await waiterPage.locator('#login-password').fill(password);
  await waiterPage.getByRole('button', { name: /sign in/i }).click();
  await expect(waiterPage).toHaveURL(/\/waiter$/);
  await expect(waiterPage.getByRole('heading', { name: 'Order desk' })).toBeVisible({ timeout: 15_000 });
  const orderSearch = waiterPage.getByRole('textbox', { name: 'Search order or table' });
  await orderSearch.fill(reference);
  await expect(waiterPage.getByText(reference).first()).toBeVisible({ timeout: 10_000 });
  await waiterPage.getByRole('button', { name: 'Review order' }).click();
  await expect(waiterPage.getByRole('dialog').getByText('Doro wat')).toBeVisible();
  await expect(waiterPage.getByRole('dialog').getByText('Extra injera')).toBeVisible();
  await waiterPage.getByRole('dialog').getByRole('button', { name: 'Accept order' }).click();
  await orderSearch.fill(secondReference);
  await expect(waiterPage.getByText(secondReference).first()).toBeVisible({ timeout: 10_000 });
  await waiterPage.getByRole('button', { name: 'Review order' }).click();
  await waiterPage.getByRole('dialog').getByRole('button', { name: 'Accept order' }).click();
  await waiterPage.getByRole('button', { name: 'Tables' }).click();
  const tableCard = waiterPage.locator('.waiter-table-card').filter({ hasText: `Table ${tableLabel}` });
  await expect(tableCard.getByText('2 separate orders')).toBeVisible();
  await expect(tableCard.getByRole('button', { name: new RegExp(reference) })).toBeVisible();
  await expect(tableCard.getByRole('button', { name: new RegExp(secondReference) })).toBeVisible();

  const kitchenApi = await playwrightRequest.newContext({ baseURL: apiBase });
  try {
    await kitchenApi.post('/api/v1/auth/login', { data: { email: 'kitchen@blue-nile.demo.local', password } }).then((r) => expect(r.ok()).toBeTruthy());
    for (const orderReference of [reference, secondReference]) {
      const queueResponse = await kitchenApi.get('/api/v1/tenant/kitchen/queue', { headers: tenantHeaders });
      expect(queueResponse.ok()).toBeTruthy();
      const queue = await queueResponse.json() as { orders: { reference: string; items: { id: string }[] }[] };
      const ticket = queue.orders.find((entry) => entry.reference === orderReference);
      expect(ticket?.items).toHaveLength(1);
      const started = await kitchenApi.patch(`/api/v1/tenant/kitchen/orders/${orderReference}/start`, { headers: tenantHeaders });
      expect(started.ok()).toBeTruthy();
      const preparing = await started.json() as { items: { id: string }[] };
      const ready = await kitchenApi.patch(`/api/v1/tenant/kitchen/orders/${orderReference}/items/${preparing.items[0]!.id}/ready`, { headers: tenantHeaders });
      expect(ready.ok()).toBeTruthy();
    }
  } finally {
    await kitchenApi.dispose();
  }

  await waiterPage.getByRole('button', { name: 'Orders' }).click();
  await orderSearch.fill(reference);
  await expect(waiterPage.getByRole('button', { name: 'Mark served' })).toBeVisible({ timeout: 15_000 });
  await waiterPage.getByRole('button', { name: 'Mark served' }).click();
  await orderSearch.fill(secondReference);
  await expect(waiterPage.getByRole('button', { name: 'Mark served' })).toBeVisible({ timeout: 15_000 });
  await waiterPage.getByRole('button', { name: 'Mark served' }).click();
  await waiterPage.getByRole('button', { name: 'Recent history' }).click();
  await waiterPage.getByLabel('Filter history date').fill(new Date().toISOString().slice(0, 10));
  await expect(waiterPage.getByText(reference).first()).toBeVisible({ timeout: 10_000 });
  await expect(waiterPage.getByText(secondReference).first()).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText('Served at your table', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(secondGuestPage.getByText('Served at your table', { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.goto(qrPath, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Request a waiter' }).click();
  await expect(page.getByText('Waiting for the team', { exact: true })).toBeVisible();
  await waiterPage.getByRole('button', { name: 'Assistance' }).click();
  await waiterPage.getByRole('button', { name: 'Acknowledge' }).click();
  await expect(page.getByText('The team is on its way', { exact: true })).toBeVisible({ timeout: 10_000 });
  await waiterPage.getByRole('button', { name: 'Mark handled' }).click();
  await expect(page.getByText('Handled', { exact: true })).toBeVisible({ timeout: 10_000 });

  const cashierContext = await page.context().browser()!.newContext({ baseURL: 'http://localhost:3000' });
  const cashierPage = await cashierContext.newPage();
  await cashierPage.goto('/login');
  await cashierPage.locator('#login-email').fill('cashier@blue-nile.demo.local');
  await cashierPage.locator('#login-password').fill(password);
  await cashierPage.getByRole('button', { name: /sign in/i }).click();
  await expect(cashierPage).toHaveURL(/\/cashier$/);
  const accessResponse = await cashierPage.request.get(`${apiBase}/api/v1/management/restaurants`);
  const access = await accessResponse.json() as { restaurants: { id: string; branches: { id: string }[] }[] };
  const restaurant = access.restaurants[0]!;
  const branch = restaurant.branches[0]!;
  const cashierHeaders = { 'X-Restaurant-Id': restaurant.id, 'X-Branch-Id': branch.id };
  const sessionsResponse = await cashierPage.request.get(`${apiBase}/api/v1/tenant/cashier/sessions`, { headers: cashierHeaders });
  expect(sessionsResponse.ok()).toBeTruthy();
  const sessions = await sessionsResponse.json() as { id: string; openedAt: string; table: { label: string } }[];
  const activeSession = sessions.find((session) => session.table.label === tableLabel)!;
  const billResponse = await cashierPage.request.get(`${apiBase}/api/v1/tenant/cashier/sessions/${activeSession.id}`, { headers: cashierHeaders });
  const bill = await billResponse.json() as { orders: { reference: string }[]; total: string };
  expect(billResponse.ok()).toBeTruthy();
  expect(bill.orders.map((entry) => entry.reference)).toEqual(expect.arrayContaining([reference, secondReference]));
  expect(Number(bill.total)).toBeGreaterThanOrEqual(1010);
  await cashierPage.locator(`[data-session-id="${activeSession.id}"]`).click();
  await expect(cashierPage.getByRole('heading', { name: 'Dining session' })).toBeVisible();
  await cashierPage.getByLabel(/Amount/).fill('500.00');
  await cashierPage.getByRole('button', { name: 'Record payment' }).click();
  await expect(cashierPage.locator('.cashier-totals').getByText('500.00 ETB')).toBeVisible();
  await cashierPage.getByLabel(/Amount/).fill((Number(bill.total) - 500).toFixed(2));
  await cashierPage.getByRole('button', { name: 'Record payment' }).click();
  await expect(cashierPage.locator('.cashier-totals').getByText(`${bill.total} ETB`)).toBeVisible();
  await cashierPage.getByRole('button', { name: 'Close table session' }).click();
  await expect(cashierPage.getByText('Table session closed.')).toBeVisible();

  const ownerContext = await page.context().browser()!.newContext({ baseURL: 'http://localhost:3000' });
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto('/login');
  await ownerPage.locator('#login-email').fill('owner@blue-nile.demo.local');
  await ownerPage.locator('#login-password').fill(password);
  await ownerPage.getByRole('button', { name: /sign in/i }).click();
  await expect(ownerPage).toHaveURL(/\/manage$/);
  await ownerPage.goto('/analytics');
  await expect(ownerPage.getByRole('heading', { name: 'Reports & analytics' })).toBeVisible();
  const analyticsResponse = await ownerPage.request.get(`${apiBase}/api/v1/tenant/analytics?from=${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}&to=${encodeURIComponent(new Date(Date.now()+86400000).toISOString())}`, { headers: cashierHeaders });
  expect(analyticsResponse.ok()).toBeTruthy();
  const analytics = await analyticsResponse.json() as { sales: { revenueReceived: string } };
  expect(Number(analytics.sales.revenueReceived)).toBeGreaterThanOrEqual(Number(bill.total));
  await ownerContext.close();
  await cashierContext.close();
  await waiterPage.close();
  await secondGuestContext.close();
});
