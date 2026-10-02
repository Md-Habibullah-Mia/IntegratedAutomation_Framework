import { test, expect } from '@playwright/test';
import { closeSharedSession, openSharedSession } from '@utils/odiobuk-session';

test.describe('Smoke - Home', () => {
  // Uses the run's shared admin session (src/utils/odiobuk-session.ts) — no
  // sign-in of its own.
  test('TC-003 - Home loads with navigation and user controls for the admin account', async ({ browser }) => {
    const { context, home } = await openSharedSession(browser);
    try {
      await home.verifyNavigationVisible();
      await expect(home.logoutButton).toBeVisible();
    } finally {
      await closeSharedSession(context);
    }
  });
});
