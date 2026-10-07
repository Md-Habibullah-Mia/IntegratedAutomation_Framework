// Odiobuk web — admin console (/admin/*). Uses the run's ONE shared admin sign-in
// (src/utils/odiobuk-session.ts). Read-only, except one QA draft title that is created,
// edited and deleted inside OA-07. Known bugs are test.fail() with their GitHub issue.
//
//   npx playwright test --project=odiobuk-chromium --grep "OA-" --workers=1

import { BrowserContext, Page, expect, test } from '@playwright/test';
import { closeSharedSession, openSharedSession } from '@utils/odiobuk-session';

test.describe.configure({ timeout: 180_000 });

let context: BrowserContext;
let page: Page;
const consoleErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  ({ context, page } = await openSharedSession(browser));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
});
test.afterAll(async () => closeSharedSession(context));

const item = (text: string) => page.locator('main .list-item').filter({ hasText: text });

// In-app navigation (React Router) instead of page.goto: every full reload spends the rotating
// refresh cookie, and several reloads in a row were seen to sign the shared session out.
async function nav(path: string) {
  if (!page.url().startsWith('http')) { await page.goto(path, { waitUntil: 'domcontentloaded' }); return; }
  await page.evaluate((p) => { window.history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, path);
  await page.waitForURL((u) => u.pathname === path.split('?')[0], { timeout: 30_000 });
}

test('OA-01 Overview shows the platform counts and the admin tabs', async () => {
  await nav('/admin');
  await expect(page.getByText('Narration limits')).toBeVisible({ timeout: 90_000 });
  for (const tab of ['Overview', 'Books', 'PDFs', 'Voices', 'Users', 'Access codes', 'Queue', 'Text guard', 'Studio', 'Method Lab']) {
    await expect(page.getByRole('link', { name: tab, exact: true }).first()).toBeVisible();
  }
  for (const card of ['House voices', 'Audiobooks']) await expect(page.locator('main').getByText(card).first()).toBeVisible();
});

test('OA-02 A narration limit outside the server bounds is not saved', async () => {
  await nav('/admin');
  await expect(page.getByText('Narration limits')).toBeVisible({ timeout: 90_000 });
  const field = page.locator('main input[type=number]').last();
  const before = await field.inputValue();
  await field.fill('100000');
  let saved = false;
  page.on('request', (r) => { if (/\/api\/admin\/settings/.test(r.url()) && r.method() !== 'GET') saved = true; });
  await page.getByRole('button', { name: 'Save limits' }).click();
  await page.waitForTimeout(2000);
  expect(saved).toBe(false);
  await nav('/admin/books'); await nav('/admin'); // leave and come back: the form refetches the saved settings
  await expect(page.locator('main input[type=number]').last()).toHaveValue(before, { timeout: 90_000 });
});

test('OA-05 Books: search, drafts filter and sort', async () => {
  await nav('/admin/books');
  await expect(page.getByText('All titles (drafts included)')).toBeVisible({ timeout: 90_000 });
  await page.getByPlaceholder('Search title or author…').fill('Austen');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(item('Pride and Prejudice')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('main .list-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Reset' }).click();
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/api\/admin\/books\?/.test(r.url()) && r.url().includes('order=asc')),
    page.locator('main select').nth(2).selectOption({ label: 'Oldest / A–Z' }),
  ]);
  expect(res.status()).toBe(200);
});

test('OA-07 Books: a QA draft title can be created, edited and deleted', async () => {
  await nav('/admin/books');
  await expect(page.getByText('All titles (drafts included)')).toBeVisible({ timeout: 90_000 });
  const form = page.getByText('New title', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Create title"]][1]');
  const create = page.getByRole('button', { name: 'Create title' });
  await expect(create).toBeDisabled();
  const title = `QA automation title ${Date.now().toString(36)}`;
  await form.locator('input:not([type]), input[type=text]').nth(0).fill(title);
  await form.locator('input:not([type]), input[type=text]').nth(1).fill('QA Automation');
  await form.getByPlaceholder(/Chapter One/).fill('Chapter One. A short QA passage — created and deleted by the automated admin suite.');
  if (await form.getByRole('checkbox').isChecked()) await form.getByRole('checkbox').uncheck();
  await create.click();
  await expect(item(title)).toContainText('draft', { timeout: 30_000 });
  try {
    await item(title).getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByText('Edit title', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Save changes"]][1]');
    await edit.locator('textarea').nth(0).fill('Edited by the automated admin suite.');
    const [saved] = await Promise.all([
      page.waitForResponse((r) => /\/api\/admin\/books\/[^/?]+$/.test(r.url()) && r.request().method() === 'PATCH'),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);
    expect(saved.status()).toBe(200);
    await nav('/admin'); await nav('/admin/books'); // leave and come back: the list refetches from the server
    await item(title).getByRole('button', { name: 'Edit' }).click({ timeout: 90_000 });
    await expect(page.getByText('Edit title', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Save changes"]][1]').locator('textarea').nth(0)).toHaveValue('Edited by the automated admin suite.');
    await page.getByRole('button', { name: 'Cancel edit' }).click();
  } finally {
    await item(title).getByRole('button', { name: '✕' }).click();
    await expect(item(title)).toHaveCount(0, { timeout: 30_000 });
  }
});

test('OA-10 PDFs: a non-PDF upload is refused', async () => {
  await nav('/admin/pdfs');
  await expect(page.getByText('All titles (drafts included)')).toBeVisible({ timeout: 90_000 });
  await page.locator('main input[type=file]').first().setInputFiles({ name: 'not-a-pdf.txt', mimeType: 'text/plain', buffer: Buffer.from('not a pdf') });
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/api\/admin\/pdfs/.test(r.url()) && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Upload as draft' }).click(),
  ]);
  expect(res.status()).toBe(415);
});

test('OA-12 Voices: house voice list and preview', async () => {
  await nav('/admin/voices');
  await expect(page.getByRole('heading', { name: 'House voices' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('button', { name: 'Publish voice' })).toBeDisabled();
  const first = page.locator('main .list-item').first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/api\/media\/voices\/.+\/preview/.test(r.url())),
    first.getByRole('button', { name: '▶' }).click(),
  ]);
  expect(res.status()).toBeLessThan(400);
});

test('OA-13 Users: the list loads when the page opens (known bug Audiobook#38)', async () => {
  test.fail(true, 'Audiobook#38 — no request is sent until a search is typed');
  await nav('/admin/users');
  await expect(page.getByText(/Changing a role/)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('main .list-item').first()).toBeVisible({ timeout: 15_000 });
});

test('OA-14 Users: search and the Admins role filter', async () => {
  await nav('/admin/users');
  const search = page.getByPlaceholder('Search email or name…');
  await expect(search).toBeVisible({ timeout: 90_000 });
  await search.fill('admin@gmail.com');
  await search.press('Enter');
  await expect(item('admin@gmail.com')).toHaveCount(1, { timeout: 30_000 });
  await page.locator('main select').nth(0).selectOption({ label: 'Admins' });
  await expect(item('admin@gmail.com')).toHaveCount(1, { timeout: 30_000 });
});

test('OA-15 Access codes: invalid uses and email are blocked before anything is created', async () => {
  await nav('/admin/codes');
  await expect(page.getByText('Issued codes')).toBeVisible({ timeout: 90_000 });
  const form = page.getByText('New code', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Create code"]][1]');
  let posted = false;
  page.on('request', (r) => { if (/access-codes/.test(r.url()) && r.method() === 'POST') posted = true; });
  await form.locator('input[type=number]').fill('0');
  await page.getByRole('button', { name: 'Create code' }).click();
  await form.locator('input[type=number]').fill('1');
  await form.locator('input[type=email]').fill('not-an-email');
  await page.getByRole('button', { name: 'Create code' }).click();
  await page.waitForTimeout(1500);
  expect(posted).toBe(false);
});

test('OA-19 Queue: status and kind filters', async () => {
  await nav('/admin/jobs');
  await expect(page.getByText(/One GPU job runs at a time/)).toBeVisible({ timeout: 90_000 });
  const [res] = await Promise.all([
    page.waitForResponse((r) => /\/api\/admin\/jobs\?/.test(r.url()) && r.url().includes('kind=capture_analysis')),
    page.locator('main select').nth(1).selectOption({ label: 'Capture analysis' }),
  ]);
  const jobs = ((await res.json()).jobs ?? []) as Array<{ kind: string }>;
  for (const j of jobs) expect(j.kind).toBe('capture_analysis');
});

test('OA-22 Studio: pipeline pages open', async () => {
  for (const path of ['/admin/studio/v1/capture', '/admin/studio/v3/verify', '/admin/studio/v4/capture', '/admin/studio/v4/documents']) {
    await nav(path);
    await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')), { timeout: 30_000 });
    await expect(page.getByText(/Not found/i)).toHaveCount(0);
  }
});

test('OA-23 Method Lab: Compare needs a voice, a passage and a method', async () => {
  await nav('/admin/studio/v4/method-lab');
  const compare = page.getByRole('button', { name: /Compare \d+ method/ });
  await expect(compare).toBeDisabled({ timeout: 90_000 });
  await page.locator('main select').first().selectOption({ index: 1 });
  await page.getByPlaceholder('Paste a passage, or arrive here from a document.').fill('A short passage for the method comparison form.');
  await expect(compare).toBeDisabled();
  await page.getByText('Method 1 — Emotion tags + one voice').locator('xpath=ancestor::*[.//input[@type="checkbox"]][1]').locator('input[type=checkbox]').first().check();
  await expect(compare).toBeEnabled();
  await expect(compare).toHaveText(/Compare 1 method/);
});

test('OA-28 No Content-Security-Policy errors in the console (known bug Audiobook#42)', async () => {
  test.fail(true, 'Audiobook#42 — an inline script is blocked by CSP on every page');
  consoleErrors.length = 0;
  await page.goto('/admin', { waitUntil: 'domcontentloaded' }); // one real page load: the CSP error happens at load time
  await expect(page.getByText('Narration limits')).toBeVisible({ timeout: 90_000 });
  expect(consoleErrors.filter((e) => /Content Security Policy/.test(e))).toEqual([]);
});
