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
//
// Single admin login for the whole file — both test cases share it.
test.describe.serial('Smoke - Upload PDF', () => {
  let context: import('@playwright/test').BrowserContext;
  let page: import('@playwright/test').Page;
  let adminPdfsPage: AdminPdfsPage;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsAdmin(page);
    adminPdfsPage = new AdminPdfsPage(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('TC-010 - Admin · PDF Catalogue page loads with the upload form and title list', async () => {
    await adminPdfsPage.goto();
    await adminPdfsPage.verifyLoaded();

    await expect(adminPdfsPage.pdfFileInput).toBeVisible();
    await expect(adminPdfsPage.allTitlesHeading).toBeVisible();
  });

  test('TC-014 - Uploading a PDF creates a draft catalogue title with its extracted text', async () => {
    const pdfPath = path.join(os.tmpdir(), `odiobuk-upload-${Date.now()}.pdf`);
    const pdfBytes = await buildMinimalPdf(
      'A short paragraph so the uploaded PDF has real extractable text.',
    );
    fs.writeFileSync(pdfPath, pdfBytes);
    const title = `QA Upload ${Date.now()}`;

    try {
      await adminPdfsPage.goto();
      await adminPdfsPage.verifyLoaded();
      await adminPdfsPage.uploadAsDraft(pdfPath, title, 'QA Author', 'Testing');

      const row = adminPdfsPage.row(title);
      await expect(row.getByText('1 pages')).toBeVisible();
      await expect(row.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Narrate', exact: true })).toBeVisible();
    } finally {
      await adminPdfsPage.remove(title).catch(() => {});
      fs.unlinkSync(pdfPath);
    }
  });
});
