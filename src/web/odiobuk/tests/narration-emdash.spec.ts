// Regression for GitHub AiSolutionsUSA/Audiobook#39: a narration whose text contains an em dash (—)
// failed in the worker with "'ascii' codec can't encode character '—'". The fix (PR #35,
// "write and read text files as UTF-8") is on develop. The catalogue title
// "The Prince — Political Philosophy" carries an em dash, so narrating it exercises the fix.
//
// @slow — one GPU job at a time, a narration takes a few minutes:
//   npx playwright test --project=odiobuk-chromium --grep "TC-025" --workers=1

import { test, expect } from '@playwright/test';
import { ListenPage } from '@web/odiobuk/pages/listen.page';
import { AudiobookDetailPage } from '@web/odiobuk/pages/audiobook-detail.page';
import { closeSharedSession, openSharedSession } from '@utils/odiobuk-session';

const GENERATION_TIMEOUT_MS = 20 * 60 * 1000;

test('TC-025 - Narrate a title containing an em dash (Audiobook#39) @slow', async ({ browser }) => {
  test.setTimeout(GENERATION_TIMEOUT_MS + 5 * 60 * 1000);
  const { context, page } = await openSharedSession(browser);
  try {
    await page.goto('/library', { waitUntil: 'domcontentloaded' });
    const row = page.locator('main').getByText('The Prince — Political Philosophy', { exact: true }).first().locator('xpath=ancestor::*[.//*[contains(normalize-space(), "Narrate")]][1]');
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.getByText(/Narrate/).first().click();
    await expect(page).toHaveURL(/\/listen\/book\//, { timeout: 30_000 });

    const listen = new ListenPage(page);
    await listen.verifyHouseVoicePreselected();
    await listen.generate();
    await listen.waitForGenerationToFinish(GENERATION_TIMEOUT_MS);

    const detail = new AudiobookDetailPage(page);
    await detail.waitForCompletion(GENERATION_TIMEOUT_MS);
    // Before the fix the job ended in Error with the 'ascii' codec message.
    await expect(detail.errorBadge).toHaveCount(0);
    await expect(detail.doneBadge).toBeVisible();
    await expect(page.getByText(/ascii' codec/)).toHaveCount(0);
  } finally {
    await closeSharedSession(context);
  }
});
