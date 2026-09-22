import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';

test.describe('Smoke - Registration', () => {
  test('TC-001 - Successful registration with valid data', async ({ page }) => {
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);

    const uniqueEmail = `qa_${Date.now()}@test.com`;

    await registrationPage.goto();
    await registrationPage.register('QA Automation', uniqueEmail, 'Str0ngP@ssword2026!');

    await homePage.verifyLoaded();
    await expect(homePage.welcomeHeading).toHaveText(/Welcome, QA/);
  });
});
