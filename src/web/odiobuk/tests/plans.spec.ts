import { test, expect } from '@playwright/test';
import { closeSharedSession, openSharedSession } from '@utils/odiobuk-session';

// Plans page and "Premium by access code" (develop, 2026-10-02 — pages/Plans.jsx).
// Uses the run's shared admin session — no sign-in of its own. Only a made-up
// code is tried, so the account's plan never changes.
test.describe('Smoke - Plans', () => {
  test('TC-023 - Plans lists Free and Premium, and an invalid access code is refused', async ({ browser }) => {
    const { context, page } = await openSharedSession(browser);
    try {
      await page.goto('/plans', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Plans' })).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole('heading', { level: 2, name: 'Free' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Premium' })).toBeVisible();
      // Perks are worded from the server's narration rules (backend test_plans.py).
      await expect(page.getByText(/^Create \d+ audiobooks? a day$/).first()).toBeVisible();
      await expect(page.getByText('One audiobook in progress at a time').first()).toBeVisible();

      await page.getByRole('button', { name: /^(Get Premium|Extend with a code)$/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Get Premium' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Activate Premium' }).click();
      await expect(dialog.getByText('Enter your Premium access code.')).toBeVisible();

      await dialog.getByLabel('Access code').fill('MW-QA00-0000');
      await dialog.getByRole('button', { name: 'Activate Premium' }).click();
      await expect(dialog.locator('.error-box')).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('dialog', { name: 'Welcome to Premium' })).toHaveCount(0);
    } finally {
      await closeSharedSession(context);
    }
  });
});
