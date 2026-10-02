import { test, expect } from '@playwright/test';
import { ProfilePage } from '@web/odiobuk/pages/profile.page';
import { closeSharedSession, openSharedSession, sharedAccount } from '@utils/odiobuk-session';

const { email: EMAIL, password: PASSWORD } = sharedAccount();

// Uses the run's shared admin session — no sign-in of its own. TC-011
// renames the account and puts the original name back; TC-012 only checks
// the delete button's enable state (never clicks delete).
test.describe.serial('Smoke - Profile (You)', () => {
  let context: import('@playwright/test').BrowserContext;
  let profilePage: ProfilePage;

  test.beforeAll(async ({ browser }) => {
    const session = await openSharedSession(browser);
    context = session.context;
    profilePage = new ProfilePage(session.page);
  });

  test.afterAll(async () => {
    await closeSharedSession(context);
  });

  test('TC-011 - Updating the display name persists across a reload', async () => {
    await profilePage.goto();
    await profilePage.verifyLoaded();

    await expect(profilePage.page.getByText(EMAIL!).first()).toBeVisible();
    const originalName = await profilePage.displayNameInput.inputValue();

    const newName = `QA Renamed ${Date.now()}`;
    try {
      await profilePage.setDisplayName(newName);
      await profilePage.page.reload({ waitUntil: 'domcontentloaded' });
      await profilePage.verifyLoaded();
      await expect(profilePage.displayNameInput).toHaveValue(newName);
    } finally {
      // Shared account: put its name back.
      await profilePage.setDisplayName(originalName);
      await profilePage.page.waitForTimeout(1000);
    }
  });

  test('TC-012 - Delete account only enables with the password and "DELETE" typed exactly', async () => {
    await profilePage.goto();
    await profilePage.verifyLoaded();

    await expect(profilePage.deleteButton).toBeDisabled();

    // Since 2026-10 the account password is required too: "DELETE" alone
    // must not unlock the button.
    await profilePage.deleteConfirmInput.fill('DELETE');
    await expect(profilePage.deleteButton).toBeDisabled();

    await profilePage.deletePasswordInput.fill(PASSWORD!);
    await profilePage.deleteConfirmInput.fill('delete');
    await expect(profilePage.deleteButton).toBeDisabled();

    await profilePage.deleteConfirmInput.fill('DELETE');
    await expect(profilePage.deleteButton).toBeEnabled();
    // Deliberately not clicked — this account is left intact.
  });
});
