import { test, expect } from '@playwright/test';
import { RegistrationPage } from '@web/odiobuk/pages/registration.page';
import { SavedPage } from '@web/odiobuk/pages/saved.page';
import { LibraryPage } from '@web/odiobuk/pages/library.page';

// Signing up IS what TC-001 checks, so it creates an account — the one
// account this run creates for a signed-in flow (everything else reuses the
// shared session, see odiobuk-session.ts). Every later test here needs a
// brand-new, ordinary (non-staff, unconfirmed, Free) account, so they reuse
// this one instead of signing up again.
const NAME = 'QA Automation';

test.describe.serial('Smoke - Registration & first run', () => {
  let context: import('@playwright/test').BrowserContext;
  let page: import('@playwright/test').Page;
  const email = `qa_${Date.now()}@test.com`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('TC-001 - Successful registration with valid data', async () => {
    const registrationPage = new RegistrationPage(page);
    await registrationPage.goto();
    await registrationPage.register(NAME, email, 'Str0ngP@ssword2026!');

    // A new account is signed in and taken to the first-run welcome.
    await page.waitForURL(/\/welcome$/, { timeout: 30000 });
    await expect(page.getByText(/^Welcome, QA! What brings you here\?/)).toBeVisible();
  });

  test('TC-020 - Welcome: choosing "Listen to audiobooks" lands on the Library', async () => {
    const options = page.getByRole('radiogroup', { name: 'What brings you here' });
    for (const title of ['Listen to audiobooks', 'Preserve a voice', 'Feel close to someone I miss']) {
      await expect(options.getByText(title)).toBeVisible();
    }
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Pick the one that fits best — or skip for now.')).toBeVisible();

    await options.getByText('Listen to audiobooks').click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/library$/, { timeout: 30000 });
    await new LibraryPage(page).verifyLoaded();
  });

  test('TC-022 - Unconfirmed account sees the "Confirm your email" banner and can hide it', async () => {
    const banner = page.getByRole('region', { name: 'Confirm your email address' });
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText(email);
    // "Resend link" is not clicked — it would send a real email.
    await expect(banner.getByRole('button', { name: /Resend/ })).toBeVisible();
    await banner.getByRole('button', { name: 'Hide this reminder' }).click();
    await expect(banner).toBeHidden();
  });

  test('TC-007 - Saved shows empty state on each tab for a brand new account', async () => {
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

  test('TC-021 - Narration page explains the Free plan daily allowance before generating', async () => {
    const libraryPage = new LibraryPage(page);
    await libraryPage.goto();
    await libraryPage.verifyLoaded();
    await libraryPage.firstNarrateButton.click();

    // components/NarrationAvailability.jsx — hidden for staff, so this needs an
    // ordinary account. Nothing is generated.
    await expect(page.getByText(/^Today: \d+ of \d+ audiobooks? · up to [\d,]+ characters each\./)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: 'Premium allows more a day →' })).toHaveAttribute('href', '/plans');
  });
});
