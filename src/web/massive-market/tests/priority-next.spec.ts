import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.describe.serial('MassiveMarket priority next coverage', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(
      process.env.LOGIN_TEST_EMAIL || 'FifthUserByReferral@test.com'
    );
    await page.locator('input[type="password"]').fill(
      process.env.LOGIN_TEST_PASSWORD || 'Flexible#123'
    );
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL(/\/me\/dashboard/, { timeout: 30000 });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('TC-011 - Invalid login credentials show validation feedback and do not navigate away', async () => {
    const guestContext = await page.context().browser()?.newContext();
    const guestPage = guestContext ? await guestContext.newPage() : null;

    if (!guestPage) {
      throw new Error('Unable to create guest page for invalid login validation test');
    }

    await guestPage.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
    await guestPage.locator('input[type="email"]').fill('invalid-user@test.com');
    await guestPage.locator('input[type="password"]').fill('wrong-password');
    await guestPage.getByRole('button', { name: 'Log In' }).click();

    await expect(guestPage).toHaveURL(/\/auth\/sign-in/, { timeout: 30000 });
    await expect(guestPage.locator('body')).toContainText(/invalid|email|password|try again|error/i, {
      timeout: 15000,
    });

    await guestContext.close();
  });

  test('TC-012 - Mismatched registration password keeps Create Account disabled', async () => {
    await page.goto('/auth/sign-up', { waitUntil: 'domcontentloaded' });

    const firstName = page.getByPlaceholder('Rohan', { exact: true });
    const lastName = page.getByPlaceholder('Iban', { exact: true });
    const email = page.locator('input[type="email"]');
    const phone = page.locator('input[type="tel"]');
    const password = page.locator('input[type="password"]').nth(0);
    const confirmPassword = page.locator('input[type="password"]').nth(1);
    const createButton = page.getByRole('button', { name: 'Create Account' });

    await firstName.fill('QA');
    await lastName.fill('Tester');
    await email.fill(`qa_${Date.now()}@test.com`);
    await phone.fill('+17365632445');
    await password.fill('Test@12345');
    await confirmPassword.fill('Test@12346');

    await expect(createButton).toBeDisabled({ timeout: 15000 });
    await expect(page.locator('body')).toContainText(/password|match|confirm/i, {
      timeout: 15000,
    });
  });

  test('TC-013 - Referral code and affiliate link are visible for an authenticated user', async () => {
    await page.goto('/me/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toContainText(/My Affiliate code|Affiliate code/i, {
      timeout: 30000,
    });
    await expect(page.locator('body')).toContainText(/[A-Z0-9]{7,}/i, {
      timeout: 30000,
    });

    await expect(page.locator('body')).toContainText(/My Affiliate link|Affiliate link/i, {
      timeout: 30000,
    });
    await expect(page.locator('body')).toContainText(/http:\/\/16\.171\.110\.244\/auth\/sign-up\?ref=/i, {
      timeout: 30000,
    });
  });

  test('TC-014 - Marketplace and order routes are accessible after login', async () => {
    await page.goto('/me/marketplace', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/me\/marketplace/, { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/Marketplace/i, {
      timeout: 30000,
    });

    await page.goto('/me/orders', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/me\/orders/, { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/My Order|Orders?/i, {
      timeout: 30000,
    });
  });
});
