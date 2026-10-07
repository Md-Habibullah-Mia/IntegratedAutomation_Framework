import { BrowserContext, Locator, Page, expect, test } from '@playwright/test';
import { closeRole, money, openRole, waitForData } from '@utils/mm-session';

// MassiveMarket admin console (/system/admin) — ONE admin sign-in with the authenticator code,
// reused across runs. Shared dev server: only validation checks and QA-owned data are changed,
// and every change is undone in the same test.

test.describe.configure({ timeout: 240_000 });

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  ({ context, page } = await openRole(browser, 'admin'));
});
test.afterAll(async () => closeRole(context, 'admin'));

const section = (title: string): Locator => page.getByText(title, { exact: true }).first().locator('xpath=ancestor::*[.//table][1]');
const rows = async (scope: Locator) => (await scope.locator('tbody tr').allInnerTexts()).map((r) => r.replace(/\s+/g, ' ').trim());

test('AD-001 Admin Panel: navigation and the four sections', async () => {
  await page.goto('/system/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Referral Partner Requests', { exact: true })).toBeVisible({ timeout: 120_000 });
  for (const item of ['Admin Panel', 'Users', 'Withdrawals', 'Orders', 'Transactions', 'Business Videos', 'Financial Reports', 'Notifications', 'FAQs', 'Security']) {
    await expect(page.locator('aside').getByText(item, { exact: true })).toBeVisible();
  }
  for (const s of ['Global Commission Settings', 'Merchant Requests', 'Merchant Fee Agreements']) await expect(page.getByText(s, { exact: true })).toBeVisible();
});

test('AD-002 Request tabs show only rows with the selected status', async () => {
  await page.goto('/system/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Referral Partner Requests', { exact: true })).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  for (const [name, api] of [['Referral Partner Requests', 'referral-partner-requests'], ['Merchant Requests', 'merchant-requests']]) {
    const sec = section(name);
    for (const tab of ['Approved', 'Rejected']) {
      await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/api/admin/${api}?status=${tab.toLowerCase()}`)),
        sec.getByRole('button', { name: tab, exact: true }).click(),
      ]);
      await page.waitForTimeout(1500);
      for (const r of (await rows(sec)).filter((x) => !/No .*found/i.test(x))) expect(r, `${name} › ${tab}`).toContain(tab);
    }
  }
});

test('AD-003 Marketer pool percentage rejects values outside 0–100 (nothing is saved)', async () => {
  await page.goto('/system/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Global Commission Settings', { exact: true })).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  const before = (await (await context.request.get('/api/admin/platform-configuration')).json()).data.marketer_pool_percentage;
  const input = page.locator('input[type=number]').first();
  for (const [value, msg] of [['101', 'less than or equal to 100'], ['-5', 'greater than or equal to 0']]) {
    await input.fill(value);
    const [res] = await Promise.all([
      page.waitForResponse((r) => /platform-configuration/.test(r.url()) && r.request().method() !== 'GET'),
      page.getByRole('button', { name: /Save settings/ }).click(),
    ]);
    expect(res.status()).toBe(400);
    expect(await res.text()).toContain(msg);
  }
  const after = (await (await context.request.get('/api/admin/platform-configuration')).json()).data.marketer_pool_percentage;
  expect(after).toBe(before);
  await page.reload({ waitUntil: 'domcontentloaded' });
});

test('AD-004 Merchant Fee Agreements search', async () => {
  await page.goto('/system/admin', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Merchant Fee Agreements', { exact: true })).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  const fa = section('Merchant Fee Agreements');
  await fa.getByPlaceholder('Search merchants or partners').fill('Solar');
  await expect.poll(async () => (await rows(fa)).every((r) => /solar/i.test(r)) && (await rows(fa)).length > 0, { timeout: 40_000 }).toBe(true);
  await fa.getByPlaceholder('Search merchants or partners').fill('');
});

test('AD-005 Users: search, status filter and the details drawer', async () => {
  await page.goto('/system/admin/users', { waitUntil: 'domcontentloaded' });
  const search = page.getByPlaceholder('Search name or email');
  await expect(search).toBeVisible({ timeout: 120_000 });
  await search.fill('demo.massivemarket.test');
  await page.waitForTimeout(5000);
  for (const r of await page.locator('main tbody tr').allInnerTexts()) expect(r).toContain('demo.massivemarket.test');
  await page.getByLabel('Filter by status').selectOption({ label: 'Active' });
  await page.waitForTimeout(4000);
  for (const r of await page.locator('main tbody tr').allInnerTexts()) expect(r).toMatch(/Active/);
  await page.locator('main tbody tr').first().getByRole('button').first().click();
  await expect(page.getByText(/USER DETAILS/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Close user details' }).click();
});

test('AD-006 Users: "Admin" role filter lists admin accounts (known bug GitHub #90)', async () => {
  test.fail(true, 'GitHub #90 — admin accounts are not listed');
  await page.goto('/system/admin/users', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Filter by role')).toBeVisible({ timeout: 120_000 });
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/api\/admin\/users\?/.test(r.url()) && r.url().includes('role=admin')),
    page.getByLabel('Filter by role').selectOption({ label: 'Admin' }),
  ]);
  expect((await res.json()).data.count).toBeGreaterThan(0);
});

test('AD-007 Users: last login is recorded (known bug GitHub #89)', async () => {
  test.fail(true, 'GitHub #89 — last_login is always null');
  const res = await (await context.request.get('/api/admin/users?page=1&page_size=50')).json();
  expect(res.data.results.some((u: { last_login: string | null }) => u.last_login)).toBe(true);
});

test('AD-008 Orders: filters, search and the fee arithmetic on an order', async () => {
  await page.goto('/system/admin/orders', { waitUntil: 'domcontentloaded' });
  const search = page.getByPlaceholder('Search orders, shops, products, or marketers');
  await expect(search).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  for (const [tab, q] of [['Awaiting Release', 'awaiting'], ['Cancelled', 'cancelled'], ['All', 'all']]) {
    const [res] = await Promise.all([
      page.waitForResponse((r) => /\/api\/admin\/orders\?/.test(r.url()) && r.url().includes(`escrow_status=${q}`)),
      page.getByRole('button', { name: tab, exact: true }).click(),
    ]);
    expect(res.status()).toBe(200);
  }
  const list = (await (await context.request.get('/api/admin/orders?escrow_status=all&page=1')).json()).data.results;
  test.skip(!list.length, 'No orders on the server');
  const o = list[0];
  await search.fill(o.order_code);
  await expect.poll(async () => (await page.locator('main tbody tr').count()), { timeout: 20_000 }).toBe(1);
  await page.getByText(o.order_code, { exact: true }).first().click();
  await expect(page).toHaveURL(/\/system\/admin\/orders\/.+/, { timeout: 60_000 });
  await expect(page.getByText('Gross sale', { exact: false }).first()).toBeVisible({ timeout: 60_000 });
  const t = await page.innerText('main');
  const v = (label: string) => money(t.match(new RegExp(`${label}\\s*\\n?\\s*(-?\\$[\\d,.]+)`, 'i'))?.[1]);
  const gross = v('Gross sale'), fee = v('Merchant fee'), pool = v('Marketer pool'), pg = v('Platform gross'), rp = v('Referral partner'), pnet = v('Platform net'), mnet = v('Merchant net');
  expect(gross).toBeCloseTo(money(o.sale_amount), 2);
  expect(mnet).toBeCloseTo(gross - fee, 2);
  expect(pg).toBeCloseTo(fee - pool, 2);
  expect(pnet).toBeCloseTo(pg - rp, 2);
});

test('AD-009 Transaction Ledger filters', async () => {
  await page.goto('/system/admin/transactions', { waitUntil: 'domcontentloaded' });
  for (const l of [/search transactions/i, /owner/i, /filter transaction type/i, /filter transaction status/i, /from date/i, /to date/i]) {
    await expect(page.getByLabel(l).first()).toBeVisible({ timeout: 120_000 });
  }
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/api\/admin\/transactions\?/.test(r.url()) && r.url().includes('type=selling_income')),
    page.getByLabel(/filter transaction type/i).selectOption({ label: 'Selling income' }),
  ]);
  expect(res.status()).toBe(200);
});

test('AD-010 Financial Reports: KPIs and date presets', async () => {
  await page.goto('/system/admin/financial-reports', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Total order volume').first()).toBeVisible({ timeout: 150_000 });
  for (const kpi of ['Accrued platform fees', 'Marketer selling & override', 'Merchant referral partners', '30-day hold queue']) await expect(page.getByText(kpi).first()).toBeVisible();
  for (const [b, q] of [['7 Days', '7d'], ['This Month', 'this_month'], ['30 Days', '30d']]) {
    const [res] = await Promise.all([
      page.waitForResponse((r) => /finance\/reports\/summary/.test(r.url()) && r.url().includes(`date_preset=${q}`)),
      page.getByRole('button', { name: b, exact: true }).click(),
    ]);
    expect(res.status()).toBe(200);
  }
});

test('AD-011 Financial Reports: a valid custom range loads (known bug GitHub #88)', async () => {
  test.fail(true, 'GitHub #88 — custom range returns 500');
  const res = await context.request.get('/api/admin/finance/reports/summary?date_preset=custom&date_from=2026-10-01&date_to=2026-10-06');
  expect(res.status()).toBe(200);
});

test('AD-012 Notifications: "Review and Publish" stays disabled until the form is complete', async () => {
  await page.goto('/system/admin/notifications', { waitUntil: 'domcontentloaded' });
  const publish = page.getByRole('button', { name: 'Review and Publish' });
  await expect(publish).toBeDisabled({ timeout: 120_000 });
  await page.locator('main input:not([type]):not([placeholder*="Search"]), main input[type=text]:not([placeholder*="Search"])').first().fill('QA draft — not sent');
  await expect(publish).toBeDisabled();
});

test('AD-013 FAQs: create and delete a QA FAQ', async () => {
  await page.goto('/system/admin/faqs', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Add FAQ' }).click({ timeout: 120_000 });
  const form = page.locator('[role=dialog], div.fixed.inset-0').last();
  const q = `QA automation FAQ ${Date.now().toString(36)}`;
  await form.locator('input[type=text], input:not([type])').first().fill(q);
  await form.locator('textarea').first().fill('Created and deleted by the automated admin suite.');
  await form.getByRole('button', { name: /Save|Create|Add/ }).last().click();
  const row = page.locator('main tbody tr').filter({ hasText: q });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  page.once('dialog', (d) => d.accept());
  await row.getByRole('button', { name: /Delete|Remove/ }).click();
  const confirm = page.locator('[role=dialog], [role=alertdialog], div.fixed.inset-0').getByRole('button', { name: /Delete|Remove|Confirm|Yes/ });
  if (await confirm.count()) await confirm.last().click();
  await expect(row).toHaveCount(0, { timeout: 30_000 });
});

test('AD-014 Security: two-step verification is on', async () => {
  await page.goto('/system/admin/security', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Two-step verification is on')).toBeVisible({ timeout: 120_000 });
});
