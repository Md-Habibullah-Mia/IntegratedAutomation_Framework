// Single-login exploration of the signed-in LexVerify app (firm admin):
// one login, then every main page's visible text + a screenshot, and the
// storage state saved for reuse so later runs needn't log in again.
//
//   npx ts-node --transpile-only scripts/attorney-explore.ts

import * as fs from 'fs';
import { chromium, Page } from '@playwright/test';
import { config } from '../src/config/env.config';

const OUT = 'reports/attorney-explore';
const STATE = '.auth/attorney-firm-admin.json';

async function snap(page: Page, name: string) {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  console.log(`\n===== ${name}  (${page.url()})\n${text.slice(0, 1500)}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync('.auth', { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: config.attorneyWebBaseUrl, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const apiErrors: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes(':8000') && r.status() >= 400) apiErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });

  await page.goto('/login?role=firm', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(process.env.ATTORNEY_FIRM_ADMIN_EMAIL!);
  await page.locator('input[autocomplete="current-password"]').fill(process.env.ATTORNEY_FIRM_ADMIN_PASSWORD!);
  const t0 = Date.now();
  await page.getByRole('button', { name: 'Secure Login' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 });
  console.log(`Login → ${page.url()} in ${Date.now() - t0} ms`);
  await context.storageState({ path: STATE });

  await snap(page, '01-after-login');
  for (const [name, path] of [
    ['02-dashboard', '/dashboard'],
    ['03-cases', '/cases'],
    ['04-cases-new', '/cases/new'],
    ['05-team-member', '/team-member'],
    ['06-tasks', '/tasks'],
    ['07-settings', '/settings'],
    ['08-documents', '/documents'],
  ]) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await snap(page, name);
  }
  const options = await page.goto('/cases/new', { waitUntil: 'networkidle' }).then(() =>
    page.locator('[data-testid="case-type-select"] option').allInnerTexts());
  console.log('\nCase type options:', options.join(' | '));
  console.log('\nAPI errors seen:', apiErrors.join(' | ') || '(none)');
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
