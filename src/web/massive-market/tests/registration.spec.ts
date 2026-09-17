import { test } from '@playwright/test';
import { RegistrationPage } from '@web/massive-market/pages/registration.page';
import { DashboardPage } from '@web/massive-market/pages/dashboard.page';

test.describe('Smoke - Registration', () => {
  test('TC-001 - Successful registration with valid data', async ({ page }) => {
    // This spec intentionally uses a fresh browser context so it does not share
    // or conflict with the shared authenticated session used by login/dashboard
    // specs. Signup and login remain isolated from each other.
    test.setTimeout(90_000);

    const registrationPage = new RegistrationPage(page);
    const dashboardPage = new DashboardPage(page);

    const uniqueEmail = `qa_${Date.now()}@test.com`;

    await registrationPage.goto();

    await registrationPage.register({
      firstName: 'QA',
      middleName: 'Automation',
      lastName: 'Tester',
      email: uniqueEmail,
      phone: process.env.TEST_PHONE!,
      password: process.env.REGISTRATION_TEST_PASSWORD!,
    });

    await dashboardPage.verifyDashboardLoaded();
  });
});
