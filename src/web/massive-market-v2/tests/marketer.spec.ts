import { BrowserContext, Page, expect, test } from '@playwright/test';
import { closeRole, openRole, waitForData } from '@utils/mm-session';

// MassiveMarket marketer (Cognito-era UI, Oct 2026). The shared account (MM_FUNC_*) is an approved
// Referral Partner with a 7-level downline. Read-only except a refused self-referral merchant
// application (the server rejects it, nothing is created).

test.describe.configure({ timeout: 180_000 });

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  ({ context, page } = await openRole(browser, 'marketer'));
});
test.afterAll(async () => closeRole(context, 'marketer'));

test('MK-001 Overview shows the four KPI cards and the MLM network', async () => {
  await page.goto('/me/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Recent Earnings Activity').first()).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  for (const card of ['Available Wallet', 'Lifetime Marketer Earnings', 'Pending Marketer Earnings', 'Active Referrals']) {
    await expect(page.getByText(card, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText('MLM Network').first()).toBeVisible();
  await expect(page.getByText('Level 1 (Direct)').first()).toBeVisible();
});

test('MK-002 An approved Referral Partner can switch to the Referral Partner dashboard', async () => {
  await page.goto('/me/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Referral Partner Approved' }).first()).toBeDisabled({ timeout: 120_000 });
  await page.locator('header button').filter({ hasText: /^(Overview|Marketer Dashboard)$/ }).first().click();
  await page.getByText(/^Referral Partner( Dashboard)?$/).last().click();
  await expect(page).toHaveURL(/referral-partner-dashboard/, { timeout: 60_000 });
  await expect(page.getByText('Recent Referral Commissions')).toBeVisible({ timeout: 120_000 });
});

test('MK-003 Marketplace lists shops and the search filters them', async () => {
  await page.goto('/me/marketplace', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Ready for promotion').first()).toBeVisible({ timeout: 120_000 });
  const all = await page.getByText('Ready for promotion').count();
  expect(all).toBeGreaterThan(1);
  await page.getByPlaceholder(/Search shops/i).fill('Solar');
  await expect.poll(() => page.getByText('Ready for promotion').count(), { timeout: 20_000 }).toBe(1);
  await expect(page.getByText('Solar Supply Co').first()).toBeVisible();
  await page.getByPlaceholder(/Search shops/i).fill('zz-no-such-shop');
  await expect(page.getByText(/No shops found/i)).toBeVisible({ timeout: 20_000 });
});

test('MK-004 Marketplace category filter finds a grocery shop (known bug GitHub #92)', async () => {
  test.fail(true, 'GitHub #92 — the filter list does not match the shops\' categories');
  await page.goto('/me/marketplace', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Fresh Basket Market').first()).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'All Categories', exact: true }).click();
  await page.getByRole('button', { name: 'Grocery & Supermarket', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Grocery & Supermarket', exact: true }).first()).toBeVisible(); // trigger now shows the choice
  await page.waitForTimeout(6000); // let the filtered list render
  await expect(page.getByText('Fresh Basket Market').first()).toBeVisible({ timeout: 5_000 });
});

test('MK-005 Create Tracking Link needs a name and at least one shop', async () => {
  await page.goto('/me/links', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Link Performance')).toBeVisible({ timeout: 120_000 });
  await page.getByRole('button', { name: 'Create Tracking Link' }).click();
  const generate = page.getByRole('button', { name: 'Generate Tracking Link' });
  await expect(generate).toBeDisabled();
  await page.waitForFunction(() => !/Loading stores/.test(document.body.innerText), null, { timeout: 60_000 });
  await page.getByPlaceholder(/Summer Campaign/).fill('QA link — not created');
  await expect(generate).toBeDisabled(); // no shop selected yet
  await page.keyboard.press('Escape');
});

test('MK-006 My Orders status filter shows only matching orders', async () => {
  await page.goto('/me/orders', { waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder(/search orders/i)).toBeVisible({ timeout: 120_000 });
  await waitForData(page);
  const status = page.getByLabel(/filter orders by status/i);
  await expect(status.locator('option')).toHaveText(['All statuses', 'Pending', 'In escrow', 'Released', 'Cancelled']);
  await status.selectOption({ label: 'Cancelled' });
  await page.waitForTimeout(4000);
  const rows = await page.locator('main tbody tr').allInnerTexts();
  for (const r of rows.filter((x) => !/No (orders|results)/i.test(x))) expect(r).toMatch(/Cancelled/);
});

test('MK-007 Wallet shows balance, escrow and lifetime cards; "View all" opens Transactions', async () => {
  await page.goto('/me/wallet', { waitUntil: 'domcontentloaded' });
  const viewAll = page.getByRole('link', { name: /view all transactions/i });
  await expect(viewAll).toBeVisible({ timeout: 120_000 });
  for (const card of ['Available Balance', 'Pending Escrow', 'Lifetime Earnings']) await expect(page.getByText(card).first()).toBeVisible();
  await viewAll.click();
  await expect(page).toHaveURL(/\/me\/transactions/, { timeout: 30_000 });
  for (const label of [/filter transaction type/i, /filter transaction status/i, /from date/i, /to date/i]) await expect(page.getByLabel(label)).toBeVisible({ timeout: 60_000 });
});

test('MK-008 Become Merchant refuses the marketer\'s own shop registration code', async () => {
  // The account's own shop registration code, taken from the Referral Partner header's copy button
  // (clipboard writes are captured — the dev site is plain http, so the real clipboard is unavailable).
  await context.addInitScript(() => {
    const copied: string[] = ((window as any).__copied = []);
    try {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => { copied.push(t); return Promise.resolve(); }, readText: () => Promise.resolve('') } });
    } catch { /* fall back to the copy event below */ }
    // Insecure-context fallback (execCommand('copy') on a hidden textarea).
    document.addEventListener('copy', () => {
      const el = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
      const text = el && 'value' in el && el.value ? el.value.substring(el.selectionStart ?? 0, el.selectionEnd ?? el.value.length) : String(document.getSelection());
      if (text) copied.push(text);
    }, true);
  });
  await page.goto('/me/referral-partner-dashboard', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Copy shop registration code' }).click({ timeout: 120_000 });
  await expect.poll(() => page.evaluate(() => ((window as any).__copied || []).length), { timeout: 15_000 }).toBeGreaterThan(0);
  const ownCode: string = await page.evaluate(() => (window as any).__copied.at(-1) ?? '');
  test.skip(!/^[A-Z0-9]{6,12}$/.test(ownCode), 'This account has no shop registration code (not a Referral Partner)');
  await page.goto('/me/become-merchant', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /become merchant/i }).last().click({ timeout: 120_000 });
  const form = page.locator('[role=dialog], div.fixed.inset-0').last();
  await expect(form.getByRole('button', { name: /create merchant account/i })).toBeVisible();
  const tag = Date.now().toString(36);
  await form.getByPlaceholder('merchant@example.com').fill(`pulseapktester+mmselfref${tag}@gmail.com`);
  await form.getByPlaceholder('Rohan').last().fill('QaSelf');
  await form.getByPlaceholder('Iban').last().fill('Ref');
  await form.locator('input[type="password"]').nth(0).fill('Mm#Qa2026!self');
  await form.locator('input[type="password"]').nth(1).fill('Mm#Qa2026!self');
  await form.getByPlaceholder('Jordan Crop').fill(`QA self-referral ${tag}`);
  await form.getByPlaceholder('http://-jordan.com').fill(`https://qa-self-${tag}.example.com`);
  await form.locator('select').first().selectOption({ label: 'Other' });
  await form.getByPlaceholder('jordan@example.com').fill(`pulseapktester+mmselfref${tag}@gmail.com`);
  await form.getByPlaceholder(/code/i).fill(ownCode);
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/api\/merchant\/shop$/.test(r.url()) && r.request().method() === 'POST'),
    form.getByRole('button', { name: /create merchant account/i }).click(),
  ]);
  expect(res.status()).toBe(400);
  await expect(page.getByText('You cannot refer your own merchant shop.').first()).toBeVisible();
  await page.keyboard.press('Escape');
});

test('MK-009 A marketer cannot open the admin console or call admin APIs', async () => {
  await page.goto('/system/admin', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/system\/admin/, { timeout: 30_000 });
  for (const api of ['/api/admin/users?page=1', '/api/admin/platform-configuration', '/api/admin/orders?escrow_status=all&page=1']) {
    expect((await context.request.get(api)).status(), api).toBe(403);
  }
});

test('MK-010 Sidebar greeting matches the time of day (known bug GitHub #100)', async () => {
  const h = new Date().getHours();
  test.skip(h >= 5 && h < 12, 'Only meaningful outside the morning — the bug is a fixed "Good morning"');
  test.fail(true, 'GitHub #100 — the greeting is a fixed "Good morning"');
  await page.goto('/me/dashboard', { waitUntil: 'domcontentloaded' });
  const greeting = page.locator('aside').getByText(/^Good (morning|afternoon|evening)$/i).first();
  await expect(greeting).toBeVisible({ timeout: 120_000 });
  await expect(greeting).toHaveText(h < 17 ? /afternoon/i : /evening/i);
});
