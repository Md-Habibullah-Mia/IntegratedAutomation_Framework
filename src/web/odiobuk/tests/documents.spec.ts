import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AdminPdfsPage } from '@web/odiobuk/pages/admin-pdfs.page';
import { buildMinimalPdf } from '@utils/pdf-fixture';
import { loginAsAdmin } from '@utils/admin-session';

// PDF upload lives at Admin · PDF Catalogue (/admin/pdfs) on this deployment,
// not a personal per-user page — see src/utils/admin-session.ts and
// admin-pdfs.page.ts. Upload creates a shared catalogue title (draft), which
// this suite cleans up afterwards so repeated runs don't pollute the
// catalogue that library.spec.ts / saved.spec.ts also read from.
test.describe('Smoke - Upload PDF', () => {
  test('TC-010 - Admin · PDF Catalogue page loads with the upload form and title list', async ({ page }) => {
    await loginAsAdmin(page);

    const adminPdfsPage = new AdminPdfsPage(page);
    await adminPdfsPage.goto();
    await adminPdfsPage.verifyLoaded();

    await expect(adminPdfsPage.pdfFileInput).toBeVisible();
    await expect(adminPdfsPage.allTitlesHeading).toBeVisible();
  });

  test('TC-014 - Uploading a PDF creates a draft catalogue title with its extracted text', async ({ page }) => {
    await loginAsAdmin(page);

    const pdfPath = path.join(os.tmpdir(), `odiobuk-upload-${Date.now()}.pdf`);
    const pdfBytes = await buildMinimalPdf(
      'A short paragraph so the uploaded PDF has real extractable text.',
    );
    fs.writeFileSync(pdfPath, pdfBytes);
    const title = `QA Upload ${Date.now()}`;

    try {
      const adminPdfsPage = new AdminPdfsPage(page);
      await adminPdfsPage.goto();
      await adminPdfsPage.verifyLoaded();
      await adminPdfsPage.uploadAsDraft(pdfPath, title, 'QA Author', 'Testing');

      const row = adminPdfsPage.row(title);
      await expect(row.getByText('1 pages')).toBeVisible();
      await expect(row.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Narrate', exact: true })).toBeVisible();
    } finally {
      await new AdminPdfsPage(page).remove(title).catch(() => {});
      fs.unlinkSync(pdfPath);
    }
  });
});
