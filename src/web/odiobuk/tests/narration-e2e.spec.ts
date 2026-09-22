// Full narration journey, end to end, against the real Admin · PDF Catalogue
// flow (/admin/pdfs) — the actual current shape of PDF-sourced narration on
// this deployment, not the old personal-document-upload flow this spec used
// to assume. See src/utils/admin-session.ts and
// src/web/odiobuk/pages/admin-pdfs.page.ts for how that was confirmed.
//
// Flow: log in as admin -> upload a PDF as a draft catalogue title -> publish
// it live -> generate its one shared house-voice narration -> poll until the
// queue finishes it. Cleans the title up afterwards so repeated runs don't
// pollute the shared catalogue that library.spec.ts / saved.spec.ts also read.
//
// Deliberately excluded from the regular smoke run: generation runs on a
// one-job-at-a-time GPU queue and can be backed up behind other jobs. Run it
// on its own:
//
//   npx playwright test --config=playwright.config.ts --project=odiobuk-chromium --grep @slow --workers=1

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AdminPdfsPage } from '@web/odiobuk/pages/admin-pdfs.page';
import { buildMinimalPdf } from '@utils/pdf-fixture';
import { loginAsAdmin } from '@utils/admin-session';

const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

test.describe('E2E - Full narration journey', () => {
  test('TC-013 - Upload a PDF, publish it, generate its narration and wait for the queue to finish it @slow', async ({ page }) => {
    test.setTimeout(GENERATION_TIMEOUT_MS + 2 * 60 * 1000);

    await loginAsAdmin(page);

    const pdfPath = path.join(os.tmpdir(), `odiobuk-e2e-${Date.now()}.pdf`);
    const pdfBytes = await buildMinimalPdf(
      'This is a short paragraph written purely so the Odiobuk automation suite has '
      + 'real extractable text to narrate end to end.',
    );
    fs.writeFileSync(pdfPath, pdfBytes);
    const title = `QA E2E ${Date.now()}`;

    const adminPdfsPage = new AdminPdfsPage(page);

    try {
      // 1. Upload the PDF as a draft catalogue title.
      await adminPdfsPage.goto();
      await adminPdfsPage.verifyLoaded();
      await adminPdfsPage.uploadAsDraft(pdfPath, title, 'QA Author', 'Testing');

      // 2. Publish it live.
      await adminPdfsPage.publish(title);

      // 3. Generate its narration with the default (auto-selected) house voice.
      await adminPdfsPage.openNarrationPanel(title);
      const voiceValue = await adminPdfsPage.houseVoiceSelect.inputValue();
      expect(voiceValue).not.toBe('');
      await adminPdfsPage.generateNarration();

      // 4. Wait for the one-job-at-a-time GPU queue to actually finish it.
      await adminPdfsPage.waitForNarrationToFinish(title, GENERATION_TIMEOUT_MS);

      // 5. Confirm the catalogue now shows it as narrated (waitForNarrationToFinish
      // already reloaded onto a fresh /admin/pdfs with this title on page one).
      const row = adminPdfsPage.row(title);
      await expect(row.getByRole('button', { name: 'Narration', exact: true })).toBeVisible();
      await expect(row.getByText('narrated')).toBeVisible();
    } finally {
      await adminPdfsPage.goto();
      await adminPdfsPage.remove(title).catch(() => {});
      fs.unlinkSync(pdfPath);
    }
  });
});
