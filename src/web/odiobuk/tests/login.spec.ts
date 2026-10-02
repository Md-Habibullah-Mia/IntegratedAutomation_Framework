import { test, expect } from '@playwright/test';
import { LoginPage } from '@web/odiobuk/pages/login.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { sharedAccount } from '@utils/odiobuk-session';

// Signing in IS what these tests check, so each does its own sign-in (the
// rest of the run reuses one shared session — see odiobuk-session.ts). They
// use the shared account itself instead of registering new ones.
const { email: EMAIL, password: PASSWORD } = sharedAccount();

test.describe('Smoke - Login', () => {
  test.skip(!EMAIL || !PASSWORD, 'MOBILE_TEST_ADMIN_EMAIL/PASSWORD not configured');

  test('TC-002 - Successful login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL!, PASSWORD!);

    await homePage.verifyLoaded();
  });

  test('TC-002B - Login with a wrong password shows no access', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL!, 'TotallyWrongPassword123!');

    // Wrong credentials must not reach the authenticated home page.
    await expect(page.getByText('Invalid email or password')).toBeVisible({ timeout: 15000 });
    await expect(page).not.toHaveURL(/\/$/, { timeout: 5000 });
  });
});
