// Second exploration pass, reusing the saved login (no new sign-in): creates
// one QA case, then records the case pages and the invite forms' structure
// (aria snapshots) so the specs can target real controls.
import * as fs from 'fs';
import { chromium, Page } from '@playwright/test';
import { config } from '../src/config/env.config';

const OUT = 'reports/attorney-explore';

async function aria(page: Page, name: string, root = 'body') {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const snap = await page.locator(root).first().ariaSnapshot();
  fs.writeFileSync(`${OUT}/${name}.aria.yml`, snap);
  console.log(`\n===== ${name} (${page.url()})\n${snap.slice(0, 2500)}`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: config.attorneyWebBaseUrl,
    storageState: '.auth/attorney-firm-admin.json',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const api: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes(':8000')) api.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });

  // Create one case for the exploration (or reuse CASE_ID from a previous run).
  let caseId = process.env.CASE_ID || '';
  if (!caseId) {
  await page.goto('/cases/new', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('Doe — EB-1A Petition').fill(`QA Explore – H-1B ${Date.now()}`);
  await page.getByTestId('case-type-select').selectOption({ label: 'H-1B Petitioner (I-129)' });
  await page.getByRole('button', { name: 'Create case' }).click();
  await page.waitForURL(/\/cases\/\d+\/team/, { timeout: 30_000 });
  caseId = page.url().match(/cases\/(\d+)/)![1];
  console.log('Created case', caseId);
  }
  await page.goto(`/cases/${caseId}/team`, { waitUntil: 'networkidle' });
  await aria(page, '10-case-team', 'body');

  await page.goto(`/cases/${caseId}`, { waitUntil: 'networkidle' });
  await aria(page, '11-case-detail', 'body');
  await page.goto(`/cases/${caseId}/questionnaires`, { waitUntil: 'networkidle' });
  await aria(page, '12-case-questionnaires', 'body');
  await page.goto(`/cases/${caseId}/documents`, { waitUntil: 'networkidle' });
  await aria(page, '13-case-documents', 'body');
  await page.goto(`/cases/${caseId}/tasks`, { waitUntil: 'networkidle' });
  await aria(page, '14-case-tasks', 'body');
  await page.goto('/cases', { waitUntil: 'networkidle' });
  await aria(page, '15-cases-list', 'body');

  // Firm team: open the Add Team Member dialog without sending anything.
  await page.goto('/team-member', { waitUntil: 'networkidle' });
  await page.getByText('Add Team Member').click();
  await aria(page, '16-add-team-member-dialog');

  fs.writeFileSync(`${OUT}/case-id.txt`, caseId);
  console.log('\nAPI calls:', [...new Set(api)].join(' | '));
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
