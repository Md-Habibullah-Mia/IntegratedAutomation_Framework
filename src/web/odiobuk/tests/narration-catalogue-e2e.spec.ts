// Full narration journey via an existing catalogue title, sidestepping the PDF
// upload step (see narration-e2e.spec.ts and its TC-014 in documents.spec.ts,
// currently blocked by a live /api/documents 500). This path uses only
// Library + Listen + audiobook detail, none of which touch that broken router,
// so it proves the generate-and-wait-for-completion mechanism end to end today.
//
// Excluded from the regular smoke run for the same reason as narration-e2e: the
// queue processes one generation job at a time and this can take several minutes.
// Run it on its own:
//
//   npx playwright test --config=playwright.config.ts --project=odiobuk-chromium --grep @slow --workers=1
//
// As of 2026-09-09 this failed fast: POST /api/v4/audiobooks returned HTTP 500,
// so no job was ever created. Fixed server-side as of 2026-09-18 — passes
// cleanly end to end (~2.5 min, mostly generation).

import { test, expect } from '@playwright/test';
import { LibraryPage } from '@web/odiobuk/pages/library.page';
import { ListenPage } from '@web/odiobuk/pages/listen.page';
import { AudiobookDetailPage } from '@web/odiobuk/pages/audiobook-detail.page';
import { closeSharedSession, openSharedSession } from '@utils/odiobuk-session';

const GENERATION_TIMEOUT_MS = 20 * 60 * 1000;

test.describe('E2E - Catalogue narration journey', () => {
  test('TC-015 - Narrate a free catalogue title with a house voice and wait for it to finish @slow', async ({ browser }) => {
    test.setTimeout(GENERATION_TIMEOUT_MS + 5 * 60 * 1000);

    // 1. The run's shared admin session — no sign-in of its own.
    const { context, page } = await openSharedSession(browser);
    try {
      // 2. Pick a free, not-yet-narrated title from the Books Catalogue.
      const libraryPage = new LibraryPage(page);
      await libraryPage.goto();
      await libraryPage.verifyLoaded();
      await expect(libraryPage.firstNarrateButton).toBeVisible({ timeout: 30000 });
      await libraryPage.firstNarrateButton.click();

      // 3. Add a voice — a house voice is auto-selected for an account that owns none.
      const listenPage = new ListenPage(page);
      await listenPage.verifyHouseVoicePreselected();

      // 4. Create the audiobook and wait for the queue to actually finish it.
      await listenPage.generate();
      await listenPage.waitForGenerationToFinish(GENERATION_TIMEOUT_MS);

      // 5. Confirm the finished narration is playable.
      const detailPage = new AudiobookDetailPage(page);
      await detailPage.waitForCompletion(60000);
      await expect(detailPage.doneBadge).toBeVisible();
    } finally {
      await closeSharedSession(context);
    }
  });
});
