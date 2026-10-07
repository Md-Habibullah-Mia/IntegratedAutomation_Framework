import { expect, test } from '@playwright/test';
import { openRole, setLanguage } from '@utils/mm-session';

// Bangla (বাংলা) language switch. The context is closed WITHOUT saving its state, so the shared
// marketer session keeps English for the other specs.

test.describe.configure({ timeout: 180_000 });

test('I18N-001 Switching to বাংলা translates the app and survives a reload', async ({ browser }) => {
  const { context, page } = await openRole(browser, 'marketer');
  try {
    await page.goto('/me/wallet', { waitUntil: 'domcontentloaded' });
    const languageButton = page.locator('header button').filter({ hasText: /^(English|বাংলা)$/ }).first();
    await expect(languageButton).toHaveText('English', { timeout: 120_000 });
    await languageButton.click();
    await page.getByText('বাংলা', { exact: true }).last().click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn', { timeout: 20_000 });
    expect((await context.cookies()).find((c) => c.name === 'mm_locale')?.value).toBe('bn');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('aside')).toContainText(/[ঀ-৿]/, { timeout: 60_000 });
    await expect(languageButton).toHaveText('বাংলা');
  } finally {
    await context.close(); // not closeRole: do not persist mm_locale=bn
  }
});

test('I18N-002 Public sign-in page is fully translated (known gaps GitHub #103)', async ({ browser }) => {
  test.fail(true, 'GitHub #103 — Log In / Sign Up tabs and the side panel stay English');
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  await setLanguage(context, 'bn');
  const page = await context.newPage();
  try {
    await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn', { timeout: 30_000 });
    await expect(page.getByText('The Global Marketing Solution')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
