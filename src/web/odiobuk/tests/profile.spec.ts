import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { HomePage } from '@web/odiobuk/pages/home.page';
import { ProfilePage } from '@web/odiobuk/pages/profile.page';

const PASSWORD = 'Str0ngP@ssword2026!';

test.describe('Smoke - Profile (You)', () => {
  test('TC-011 - Updating the display name persists across a reload', async ({ page }) => {
    const email = `qa_profile_${Date.now()}@test.com`;
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Profile', email, PASSWORD);
    await homePage.verifyLoaded();

    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    await profilePage.verifyLoaded();

    await expect(profilePage.page.getByText(email).first()).toBeVisible();

    const newName = `QA Renamed ${Date.now()}`;
    await profilePage.setDisplayName(newName);

    await profilePage.page.reload({ waitUntil: 'domcontentloaded' });
    await profilePage.verifyLoaded();
    await expect(profilePage.displayNameInput).toHaveValue(newName);
  });

  test('TC-012 - Delete account only enables once "DELETE" is typed exactly', async ({ page }) => {
    const email = `qa_profiledelete_${Date.now()}@test.com`;
    const registrationPage = new RegistrationPage(page);
    const homePage = new HomePage(page);
    await registrationPage.goto();
    await registrationPage.register('QA Profile Delete', email, PASSWORD);
    await homePage.verifyLoaded();

    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    await profilePage.verifyLoaded();

    await expect(profilePage.deleteButton).toBeDisabled();

    await profilePage.deleteConfirmInput.fill('delete');
    await expect(profilePage.deleteButton).toBeDisabled();

    await profilePage.deleteConfirmInput.fill('DELETE');
    await expect(profilePage.deleteButton).toBeEnabled();
    // Deliberately not clicked — this account is left intact.
  });
});
