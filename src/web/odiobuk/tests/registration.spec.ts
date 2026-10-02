import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { SavedPage } from '@web/odiobuk/pages/saved.page';

// Signing up IS what TC-001 checks, so it creates an account — the one
// account this run creates for a signed-in flow (everything else reuses the
// shared session, see odiobuk-session.ts). TC-007 needs a brand-new account
// too, so it reuses this one instead of signing up again.
test.describe.serial('Smoke - Registration', () => {
  let context: import('@playwright/test').BrowserContext;
  let page: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('TC-001 - Successful registration with valid data', async () => {
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);

    await registrationPage.goto();
    await registrationPage.register('QA Automation', `qa_${Date.now()}@test.com`, 'Str0ngP@ssword2026!');

    await homePage.verifyLoaded();
    await expect(homePage.welcomeHeading).toHaveText(/Welcome, QA/);
  });

  test('TC-007 - Saved shows empty state on each tab for a brand new account', async () => {
    const savedPage = new SavedPage(page);
    await savedPage.goto();
    await savedPage.verifyLoaded();

    // Books tab is the default.
    await expect(savedPage.emptyMessage('book')).toBeVisible();

    await savedPage.pdfsTab.click();
    await expect(savedPage.emptyMessage('pdf')).toBeVisible();

    await savedPage.audiobooksTab.click();
    await expect(savedPage.emptyMessage('audiobook')).toBeVisible();
  });
});
