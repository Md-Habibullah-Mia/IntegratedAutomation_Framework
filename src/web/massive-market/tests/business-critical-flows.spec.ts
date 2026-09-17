import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { LoginPage } from '@web/massive-market/pages/login.page';

test.describe.serial('MassiveMarket business-critical flows', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(
      process.env.LOGIN_TEST_EMAIL || '',
      process.env.LOGIN_TEST_PASSWORD || ''
    );
    await page.waitForURL(/\/me\/dashboard/, { timeout: 30000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('TC-004 - Referral code and affiliate link values are visible', async () => {
    await page.goto('/me/dashboard');

    await expect(page.locator('body')).toContainText(/My Affiliate code/i, {
      timeout: 30000,
    });
    await expect(page.locator('body')).toContainText(/[A-Z0-9]{7,}/i, {
      timeout: 30000,
    });

    await expect(page.locator('body')).toContainText(/My Affiliate link/i, {
      timeout: 30000,
    });
    await expect(page.locator('body')).toContainText(/http:\/\/16\.171\.110\.244\/auth\/sign-up\?ref=/i, {
      timeout: 30000,
    });
  });

  test('TC-005 - Wallet view loads successfully', async () => {
    await page.goto('/me/wallet');

    await expect(page).toHaveURL(/\/me\/wallet/, { timeout: 30000 });
    await expect(
      page.getByRole('heading', { name: /wallet/i, level: 1 })
    ).toBeVisible({ timeout: 30000 });
  });

  test('TC-006 - Transactions view loads successfully', async () => {
    await page.goto('/me/transactions');

    await expect(page).toHaveURL(/\/me\/transactions/, { timeout: 30000 });
    await expect(
      page.getByRole('heading', { name: /transactions?/i, level: 1 })
    ).toBeVisible({ timeout: 30000 });
  });

  test('TC-007 - Protected routes remain accessible to an authenticated user', async () => {
    await page.goto('/me/dashboard');
    await expect(page).toHaveURL(/\/me\/dashboard/);

    await page.goto('/me/wallet');
    await expect(page).toHaveURL(/\/me\/wallet/);

    await page.goto('/me/transactions');
    await expect(page).toHaveURL(/\/me\/transactions/);
  });

  test('TC-008 - Marketplace browse page loads the marketplace shell', async () => {
    await page.goto('/me/marketplace');

    await expect(page).toHaveURL(/\/me\/marketplace/, { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/Marketplace/i, {
      timeout: 30000,
    });
  });

  test('TC-009 - Order history page loads for the logged-in user', async () => {
    await page.goto('/me/orders');

    await expect(page).toHaveURL(/\/me\/orders/, { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/My Order|Orders?/i, {
      timeout: 30000,
    });
  });

  test('TC-010 - Unauthenticated user is redirected away from protected pages', async ({ browser }) => {
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    await guestPage.goto('/me/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(guestPage).toHaveURL(/\/auth\/sign-in/, { timeout: 30000 });

    await guestContext.close();
  });
});
