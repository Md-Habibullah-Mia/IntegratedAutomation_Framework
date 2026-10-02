import { test, expect } from '@playwright/test';

// Signed-out account flows added on develop (2026-10-02): password reset,
// email confirmation links, and the show-password toggle. Public pages — no
// sign-in at all. No email is sent to a real person: the reset request uses
// an address with no account, and nothing here clicks "Resend".
//
// Strings come from the app source (AiSolutionsUSA/Audiobook, origin/develop,
// Restful-App/frontend/src/pages/{ForgotPassword,ResetPassword,VerifyEmail}.jsx
// and components/PasswordInput.jsx).

test.describe('Account recovery & verification (signed out)', () => {
  test('TC-016 - Forgot password answers the same whether or not the account exists', async ({ page }) => {
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Reset your password')).toBeVisible({ timeout: 30000 });
    await page.getByLabel('Email').fill(`qa_noaccount_${Date.now()}@test.com`);
    await page.getByRole('button', { name: 'Send reset link' }).click();

    // A neutral acknowledgement — never "no such account" (no user enumeration).
    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/no account|not found|does not exist|isn't registered/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });

  test('TC-017 - Reset password without a token offers to request a new link', async ({ page }) => {
    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Set new password' })).toHaveCount(0);
  });

  test('TC-018 - Email confirmation link without a valid token is refused with a way forward', async ({ page }) => {
    await page.goto('/verify-email', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/missing its token/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: /Send a new link|Send again/ })).toBeVisible();

    await page.goto('/verify-email?token=qa-not-a-real-token', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/invalid|expired|already been used|no longer valid/i).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Email address confirmed.')).toHaveCount(0);
  });

  test('TC-019 - Sign-in password field can be shown and hidden', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const password = page.getByRole('textbox', { name: 'Password' }).or(page.locator('#password'));
    const toggle = page.getByRole('button', { name: 'Show password' });
    await expect(toggle).toBeVisible({ timeout: 30000 });
    await password.first().fill('Secret-123');

    await expect(page.locator('input[type="password"]')).toHaveCount(1);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await toggle.click();
    await expect(page.locator('input[type="password"]')).toHaveCount(1);
  });
});
