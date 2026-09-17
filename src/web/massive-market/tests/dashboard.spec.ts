import { test, expect } from '@playwright/test';
import { LoginPage } from '@web/massive-market/pages/login.page';
import { DashboardPage } from '@web/massive-market/pages/dashboard.page';

test.describe('Smoke - Dashboard', () => {
  test('TC-003 - Dashboard loads with heading, navigation, and user controls after login', async ({ page }) => {
    test.setTimeout(60_000);

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(
      process.env.LOGIN_TEST_EMAIL!,
      process.env.LOGIN_TEST_PASSWORD!
    );

    await dashboardPage.verifyDashboardLoaded();
    await expect(dashboardPage.availableWalletLabel).toBeVisible();

    await dashboardPage.verifyNavigationVisible();
    await expect(dashboardPage.logOutButton).toBeVisible();
  });
});
