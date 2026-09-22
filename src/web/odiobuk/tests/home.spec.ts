import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '@utils/admin-session';

test.describe('Smoke - Home', () => {
  // "Upload PDF" only appears in nav for the admin account (see
  // src/utils/admin-session.ts) — a freshly registered account never gets
  // it, so this now logs in as admin rather than registering fresh.
  test('TC-003 - Home loads with navigation and user controls for the admin account', async ({ page }) => {
    const homePage = await loginAsAdmin(page);

    await homePage.verifyNavigationVisible();
    await expect(homePage.logoutButton).toBeVisible();
  });
});
