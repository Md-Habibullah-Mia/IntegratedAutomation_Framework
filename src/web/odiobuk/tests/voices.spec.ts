import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { VoicesPage } from '@web/odiobuk/pages/voices.page';

const PASSWORD = 'Str0ngP@ssword2026!';

test.describe('Smoke - Voices', () => {
  test('TC-008 - Voice hub lists at least one narratable platform voice', async ({ page }) => {
    const email = `qa_voices_${Date.now()}@test.com`;
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Voices', email, PASSWORD);
    await homePage.verifyLoaded();

    const voicesPage = new VoicesPage(page);
    await voicesPage.goto();
    await voicesPage.verifyLoaded();

    await expect(voicesPage.myVoicesTab).toBeVisible();
    await expect(voicesPage.lentByOthersTab).toBeVisible();

    // A fresh account owns no voices, but the platform ships at least one house
    // voice so every listener can narrate from day one.
    await expect(voicesPage.page.locator('.list-item').first()).toBeVisible();
    await expect(voicesPage.page.getByRole('button', { name: /Narrate/ }).first()).toBeVisible();
  });

  test('TC-009 - Register voice stays disabled until a session and name are given', async ({ page }) => {
    const email = `qa_voicesreg_${Date.now()}@test.com`;
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Voices Reg', email, PASSWORD);
    await homePage.verifyLoaded();

    const voicesPage = new VoicesPage(page);
    await voicesPage.goto();
    await voicesPage.verifyLoaded();

    // A brand-new account has no capture session, so the form cannot be completed
    // regardless of what else is filled in.
    await expect(voicesPage.registerButton).toBeDisabled();

    await voicesPage.voiceNameInput.fill('Test Voice');
    await expect(voicesPage.registerButton).toBeDisabled();
  });
});
