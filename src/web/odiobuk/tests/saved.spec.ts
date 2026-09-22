import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { SavedPage } from '@web/odiobuk/pages/saved.page';

const PASSWORD = 'Str0ngP@ssword2026!';

test.describe('Smoke - Saved', () => {
  test('TC-007 - Saved shows empty state on each tab for a brand new account', async ({ page }) => {
    const email = `qa_saved_${Date.now()}@test.com`;
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Saved', email, PASSWORD);
    await homePage.verifyLoaded();

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
