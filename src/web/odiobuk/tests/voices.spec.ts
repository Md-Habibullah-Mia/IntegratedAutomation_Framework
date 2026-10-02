import { test, expect } from '@playwright/test';
import { VoicesPage } from '@web/odiobuk/pages/voices.page';
import { closeSharedSession, openSharedSession } from '@utils/odiobuk-session';

// Uses the run's shared admin session — no sign-in of its own. Both tests
// only read voice/session state; nothing is registered or changed.
test.describe.serial('Smoke - Voices', () => {
  let context: import('@playwright/test').BrowserContext;
  let voicesPage: VoicesPage;

  test.beforeAll(async ({ browser }) => {
    const session = await openSharedSession(browser);
    context = session.context;
    voicesPage = new VoicesPage(session.page);
  });

  test.afterAll(async () => {
    await closeSharedSession(context);
  });

  test('TC-008 - Voice hub lists at least one narratable platform voice', async () => {
    await voicesPage.goto();
    await voicesPage.verifyLoaded();

    await expect(voicesPage.myVoicesTab).toBeVisible();
    await expect(voicesPage.lentByOthersTab).toBeVisible();

    // The platform ships at least one house voice so every listener can
    // narrate from day one, whatever voices the account owns.
    await expect(voicesPage.page.locator('.list-item').first()).toBeVisible();
    await expect(voicesPage.page.getByRole('button', { name: /Narrate/ }).first()).toBeVisible();
  });

  test('TC-009 - Register voice stays disabled until a session and name are given', async () => {
    await voicesPage.goto();
    await voicesPage.verifyLoaded();

    // With no capture session chosen, the form cannot be completed regardless
    // of what else is filled in.
    await expect(voicesPage.registerButton).toBeDisabled();

    await voicesPage.voiceNameInput.fill('Test Voice');
    await expect(voicesPage.registerButton).toBeDisabled();
  });
});
