// One-off helper for the LexVerify pilot: registers the firm-admin account
// from .env.dev.local through the real UI, then (second run, with the OTP the
// user reads from the mailbox) confirms it on /verify.
//
//   npx ts-node --transpile-only scripts/attorney-register.ts            # register → OTP email sent
//   npx ts-node --transpile-only scripts/attorney-register.ts 123456     # confirm with the emailed code

import { chromium } from '@playwright/test';
import { config } from '../src/config/env.config';

const email = process.env.ATTORNEY_FIRM_ADMIN_EMAIL;
const password = process.env.ATTORNEY_FIRM_ADMIN_PASSWORD;
const otp = process.argv[2];

(async () => {
  if (!email || !password) throw new Error('ATTORNEY_FIRM_ADMIN_EMAIL / _PASSWORD missing in .env.dev.local');
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: config.attorneyWebBaseUrl });
  const apiCalls: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/auth/')) apiCalls.push(`${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()}`);
  });

  if (!otp) {
    await page.goto('/register', { waitUntil: 'networkidle' });
    await page.getByPlaceholder('Work Email').fill(email);
    await page.getByPlaceholder('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create Secure Account' }).click();
    await page.waitForURL(/\/verify|\/register/, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(2500);
  } else {
    // /verify reads the email from localStorage, exactly as the register step leaves it.
    await page.goto('/verify', { waitUntil: 'networkidle' });
    await page.evaluate((e) => localStorage.setItem('lexverify_auth', JSON.stringify({ registrationEmail: e })), email);
    await page.reload({ waitUntil: 'networkidle' });
    for (let i = 0; i < 6; i += 1) await page.getByLabel(`Verification digit ${i + 1}`).fill(otp[i]);
    await page.waitForURL(/\/login/, { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  console.log('URL:', page.url());
  console.log('Auth calls:', apiCalls.join(' | ') || '(none)');
  const errs = await page.locator('.error-msg').allInnerTexts();
  if (errs.length) console.log('Errors on page:', errs.join(' | '));
  await page.screenshot({ path: `reports/screenshots/attorney-register-${otp ? 'confirm' : 'start'}.png`, fullPage: true });
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
