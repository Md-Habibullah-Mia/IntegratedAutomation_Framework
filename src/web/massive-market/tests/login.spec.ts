import { test } from '@playwright/test';
import { LoginPage } from '@web/massive-market/pages/login.page';
import { DashboardPage } from '@web/massive-market/pages/dashboard.page';

test.describe('Smoke - Login', () => {
  test('TC-002 - Successful login with valid credentials', async ({ page }) => {
    test.setTimeout(60_000);

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(
      process.env.LOGIN_TEST_EMAIL!,
      process.env.LOGIN_TEST_PASSWORD!
    );

    await dashboardPage.verifyDashboardLoaded();
  });
});
