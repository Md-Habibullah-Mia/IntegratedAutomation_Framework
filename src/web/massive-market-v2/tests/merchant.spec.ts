import { BrowserContext, Page, expect, test } from '@playwright/test';
import { closeRole, money, openRole, waitForData } from '@utils/mm-session';

// MassiveMarket merchant dashboard. Expected numbers are taken from the merchant's own API at run
// time, so the checks hold whatever orders exist. Read-only, except a profile edit that is undone.

test.describe.configure({ timeout: 180_000 });

let context: BrowserContext;
let page: Page;
let summary: { gross_sales: string; platform_fees: string; merchant_net: string; order_count: number };
let finance: { pending_escrow_fees: string; total_accrued_fees: string };
let pendingOrders = 0;

test.beforeAll(async ({ browser }) => {
  ({ context, page } = await openRole(browser, 'merchant'));
  const dash = await (await context.request.get('/api/merchant/dashboard?range=30d')).json();
  summary = dash.data.overview.summary;
  const fin = await (await context.request.get('/api/merchant/finance/summary')).json();
  finance = fin.data.summary;
  pendingOrders = fin.data.counts.pending_escrow_orders;
});
test.afterAll(async () => closeRole(context, 'merchant'));

test('MD-001 Overview KPIs match the merchant\'s sales', async () => {
  await page.goto('/me/merchant-dashboard/overview', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Recent Orders' })).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  const text = await page.innerText('main');
  for (const v of [summary.gross_sales, summary.platform_fees, summary.merchant_net]) {
    expect(text).toContain(`$${money(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  }
  expect(text).toContain(`${summary.order_count} valid order`);
  expect(money(summary.merchant_net)).toBeCloseTo(money(summary.gross_sales) - money(summary.platform_fees), 2);
});

test('MD-003 Sales Analytics shows the same totals once loaded', async () => {
  await page.goto('/me/merchant-dashboard/sales-analytics', { waitUntil: 'domcontentloaded' });
  const gross = `$${money(summary.gross_sales).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  await expect(page.locator('main').getByText(gross).first()).toBeVisible({ timeout: 120_000 });
  for (const r of ['7D', '90D', '12M', '30D']) {
    const [res] = await Promise.all([
      page.waitForResponse((x) => /\/api\/merchant\/dashboard\?/.test(x.url()) && x.url().includes(`range=${r.toLowerCase()}`)),
      page.getByRole('button', { name: r, exact: true }).click(),
    ]);
    expect(res.status()).toBe(200);
  }
});

test('MD-004 Sales Analytics shows no $0 placeholders while loading (known bug GitHub #101)', async () => {
  test.skip(money(summary.gross_sales) === 0, 'Needs a merchant with sales');
  test.fail(true, 'GitHub #101 — $0.00 / "No sales in this period." is shown while loading');
  await page.goto('/me/merchant-dashboard/sales-analytics', { waitUntil: 'domcontentloaded' });
  await page.getByText('Gross Sales').first().waitFor({ timeout: 60_000 });
  await expect(page.getByText('No sales in this period.')).toHaveCount(0, { timeout: 1000 });
});

test('MD-007 Sales & Fees status filter', async () => {
  await page.goto('/me/merchant-dashboard/sales-fees', { waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder('Search order or product')).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  const status = page.locator('main select').first();
  for (const [label, word] of [['In escrow', 'In escrow'], ['Cancelled', 'Cancelled']]) {
    await Promise.all([
      page.waitForResponse((r) => /\/api\/merchant\/sales\?/.test(r.url()) && !r.url().includes('status=all')),
      status.selectOption({ label }),
    ]);
    await page.waitForTimeout(1500);
    const rows = (await page.locator('main tbody tr').allInnerTexts()).filter((r) => !/No sales match/i.test(r));
    for (const r of rows) expect(r).toContain(word);
  }
});

test('MD-008 Financial Statement pending escrow matches the API', async () => {
  await page.goto('/me/merchant-dashboard/financials', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(`${pendingOrders} orders in 30-day escrow hold`)).toBeVisible({ timeout: 120_000 });
  const pending = `$${money(finance.pending_escrow_fees).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  await expect(page.locator('main').getByText(pending).first()).toBeVisible();
});

test('MD-010 Escrow explanation formats amounts with one "$" (known bug GitHub #102)', async () => {
  test.fail(true, 'GitHub #102 — amounts are printed as $$45.00');
  await page.goto('/me/merchant-dashboard/financials', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('How Escrow & Accrual Works')).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  expect(await page.innerText('main')).not.toMatch(/\$\$\d/);
});

test('MD-013 Settings tabs: Account, Business (webhook integration), Shop', async () => {
  await page.goto('/me/merchant-dashboard/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Personal Information')).toBeVisible({ timeout: 120_000 });
  await page.locator('main button').filter({ hasText: /^Business$/ }).click();
  await expect(page.getByText(/WEBHOOK ENDPOINT/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^SHOP UUID$/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Rotate secret' })).toBeVisible();
  await page.locator('main button').filter({ hasText: /^Shop$/ }).click();
  await expect(page.getByRole('button', { name: 'Save shop' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Delete shop' })).toBeVisible();
});

test('MD-015 Change Password rejects a wrong current password', async () => {
  await page.goto('/me/merchant-dashboard/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Personal Information')).toBeVisible({ timeout: 120_000 });
  const pw = page.locator('main input[type=password]');
  await pw.nth(0).fill('Wrong#Pass123');
  await pw.nth(1).fill('NewPass#2026x');
  await pw.nth(2).fill('NewPass#2026x');
  const [res] = await Promise.all([
    page.waitForResponse((r) => /password\/change/.test(r.url())),
    page.getByRole('button', { name: 'Update Password' }).click(),
  ]);
  expect(res.status()).toBe(400);
  await expect(page.getByText('Invalid old password')).toBeVisible();
});

test('MD-018 A merchant is kept inside the merchant dashboard', async () => {
  for (const url of ['/me/dashboard', '/me/marketplace', '/system/admin']) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/merchant-dashboard|sign-in/, { timeout: 60_000 });
  }
  expect((await context.request.get('/api/admin/users?page=1')).status()).toBe(403);
  expect((await context.request.get('/api/gateway/links')).status()).toBe(403);
});
