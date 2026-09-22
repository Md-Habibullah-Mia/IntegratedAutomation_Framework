import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { VoicesPage } from '@web/odiobuk/pages/voices.page';

const PASSWORD = 'Str0ngP@ssword2026!';

// Single registration/login for the whole file — both test cases only read
// the fresh account's (empty) voice/session state, so one account covers both.
test.describe.serial('Smoke - Voices', () => {
  let context: import('@playwright/test').BrowserContext;
  let page: import('@playwright/test').Page;
  let voicesPage: VoicesPage;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    const email = `qa_voices_${Date.now()}@test.com`;
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Voices', email, PASSWORD);
    await homePage.verifyLoaded();

    voicesPage = new VoicesPage(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('TC-008 - Voice hub lists at least one narratable platform voice', async () => {
    await voicesPage.goto();
    await voicesPage.verifyLoaded();

    await expect(voicesPage.myVoicesTab).toBeVisible();
    await expect(voicesPage.lentByOthersTab).toBeVisible();

    // A fresh account owns no voices, but the platform ships at least one house
    // voice so every listener can narrate from day one.
    await expect(voicesPage.page.locator('.list-item').first()).toBeVisible();
    await expect(voicesPage.page.getByRole('button', { name: /Narrate/ }).first()).toBeVisible();
  });

  test('TC-009 - Register voice stays disabled until a session and name are given', async () => {
    await voicesPage.goto();
    await voicesPage.verifyLoaded();

    // A brand-new account has no capture session, so the form cannot be completed
    // regardless of what else is filled in.
    await expect(voicesPage.registerButton).toBeDisabled();

    await voicesPage.voiceNameInput.fill('Test Voice');
    await expect(voicesPage.registerButton).toBeDisabled();
  });
});
