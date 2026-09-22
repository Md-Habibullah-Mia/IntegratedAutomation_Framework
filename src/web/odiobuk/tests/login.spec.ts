import { test, expect } from '@playwright/test';
import { LoginPage } from '@web/odiobuk/pages/login.page';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';

const PASSWORD = 'Str0ngP@ssword2026!';

test.describe('Smoke - Login', () => {
  test('TC-002 - Successful login with valid credentials', async ({ page }) => {
    const email = `qa_${Date.now()}@test.com`;

    // Self-contained: register a fresh account, log out, then log back in —
    // no dependency on a fixed shared test account.
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Login', email, PASSWORD);
    await homePage.verifyLoaded();
    await homePage.logout();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, PASSWORD);

    await homePage.verifyLoaded();
  });

  test('TC-002B - Login with a wrong password shows no access', async ({ page }) => {
    const email = `qa_${Date.now()}@test.com`;

    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Login Negative', email, PASSWORD);
    await homePage.verifyLoaded();
    await homePage.logout();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, 'TotallyWrongPassword123!');

    // Wrong credentials must not reach the authenticated home page.
    await expect(page).not.toHaveURL(/\/$/, { timeout: 5000 });
  });
});
