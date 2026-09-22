import { Page, expect } from '@playwright/test';

/**
 * Logs in to MassiveMarket, tolerating a real flakiness in the live app: the
 * Log In button sometimes stays disabled for many seconds after both fields
 * are filled (the client-side validation lags behind field state), and can
 * occasionally need the fields re-entered to catch up. Retries the fill
 * rather than just waiting longer once, since a long single wait sometimes
 * never resolves but a re-fill unsticks it.
 */
export async function loginToMassiveMarket(page: Page, email: string, password: string) {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const loginButton = page.getByRole('button', { name: 'Log In' });

  await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });

  for (let attempt = 1; attempt <= 3; attempt++) {
    await emailInput.fill('');
    await emailInput.pressSequentially(email, { delay: 40 });
    await passwordInput.fill('');
    await passwordInput.pressSequentially(password, { delay: 40 });
    try {
      await expect(loginButton).toBeEnabled({ timeout: 10000 });
      break;
    } catch {
      if (attempt === 3) throw new Error('Log In button never became enabled after 3 fill attempts');
    }
  }

  await loginButton.click();
  // waitUntil: 'domcontentloaded' — some background request on post-login
  // pages never settles, so the default 'load' wait hangs even after the
  // URL has already changed (same issue LoginPage.goto() works around).
  await page.waitForURL(/\/me\//, { timeout: 30000, waitUntil: 'domcontentloaded' });
}
