import * as fs from 'fs';
import * as path from 'path';
import { Browser, BrowserContext, Page, expect, test } from '@playwright/test';
import { config } from '@config/env.config';
import { freshTotp } from './totp';

// ONE sign-in per role for the whole MassiveMarket v2 run (framework rule).
//
// The dev server's login limit is 10 per hour and, at the time of writing, it is shared by
// every visitor (GitHub #91), so signing in per test would lock the suite out within minutes.
// Each role's session is cached in .auth/mm-<role>.json and reused across runs while the
// server still accepts it (GET /api/auth/session → isAuthenticated). Only when it has
// expired does the helper sign in again — once.

export type MmRole = 'marketer' | 'merchant' | 'admin';

const AUTH_DIR = path.resolve(__dirname, '../../.auth');
const stateFile = (role: MmRole) => path.join(AUTH_DIR, `mm-${role}.json`);

export function credentials(role: MmRole) {
  const mm = config.massiveMarket;
  if (role === 'admin') return { email: mm.adminEmail, password: mm.adminPassword, totpSecret: mm.adminTotpSecret };
  if (role === 'merchant') return { email: mm.merchantEmail, password: mm.merchantPassword };
  return { email: mm.marketerEmail, password: mm.marketerPassword };
}

async function isSignedIn(context: BrowserContext): Promise<boolean> {
  const res = await context.request.get('/api/auth/session').catch(() => null);
  if (!res || !res.ok()) return false;
  const body = await res.json().catch(() => ({}));
  return Boolean(body?.data?.isAuthenticated);
}

async function signIn(page: Page, role: MmRole) {
  const { email, password, totpSecret } = credentials(role) as { email?: string; password?: string; totpSecret?: string };
  test.skip(!email || !password, `MassiveMarket ${role} credentials are not configured in .env.<env>.local`);
  if (role === 'admin') {
    test.skip(!totpSecret, 'MASSIVE_MARKET_ADMIN_TOTP_SECRET is not configured (the admin console always asks for MFA)');
    await page.goto('/system/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('admin@company.com').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Two-step verification', { exact: true }).waitFor({ timeout: 60_000 });
    await page.locator('input').first().click();
    await page.keyboard.type(await freshTotp(totpSecret!), { delay: 50 });
    await page.getByRole('button', { name: 'Verify' }).click();
    await page.waitForURL(/\/system\/admin/, { timeout: 60_000, waitUntil: 'domcontentloaded' });
    return;
  }
  // The Log In button can stay disabled for a while after the fields are filled; re-typing unsticks it.
  await page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: /^log ?in$/i }).last();
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.locator('input[type="email"]').first().fill('');
    await page.locator('input[type="email"]').first().pressSequentially(email!, { delay: 20 });
    await page.locator('input[type="password"]').first().fill('');
    await page.locator('input[type="password"]').first().pressSequentially(password!, { delay: 20 });
    if (await button.isEnabled()) break;
    await page.waitForTimeout(1500);
  }
  await button.click();
  await page.waitForURL(/\/me\//, { timeout: 60_000, waitUntil: 'domcontentloaded' }).catch(async () => {
    const msg = (await page.innerText('body')).match(/Too many attempts[^.]*\./)?.[0];
    throw new Error(`MassiveMarket ${role} sign-in failed${msg ? `: ${msg} (shared login throttle, GitHub #91)` : ''}`);
  });
}

// The UI language is a cookie (mm_locale); assertions are written against the English texts.
export async function setLanguage(context: BrowserContext, lang: 'en' | 'bn') {
  await context.clearCookies({ name: 'mm_locale' });
  await context.addCookies([{ name: 'mm_locale', value: lang, url: config.massiveMarketWebBaseUrl }]);
}
const english = (context: BrowserContext) => setLanguage(context, 'en');

/** Context + page signed in as `role`, reusing the cached session when it is still valid. */
export async function openRole(browser: Browser, role: MmRole): Promise<{ context: BrowserContext; page: Page }> {
  const file = stateFile(role);
  if (fs.existsSync(file)) {
    const context = await browser.newContext({ baseURL: config.massiveMarketWebBaseUrl, storageState: file });
    await english(context);
    if (await isSignedIn(context)) return { context, page: await context.newPage() };
    await context.close();
  }
  const context = await browser.newContext({ baseURL: config.massiveMarketWebBaseUrl });
  await english(context);
  const page = await context.newPage();
  await signIn(page, role);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await context.storageState({ path: file });
  return { context, page };
}

/** Always close through this: the refresh cookie may have rotated during the run. */
export async function closeRole(context: BrowserContext | undefined, role: MmRole) {
  if (!context) return;
  await context.storageState({ path: stateFile(role) }).catch(() => {});
  await context.close();
}

/** Waits until no visible "Loading…" text or pulse skeleton is left in <main> (pages take 5–15 s on dev). */
export async function waitForData(page: Page, timeout = 90_000) {
  await page.waitForTimeout(1500);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll('main *')].some(
            (e) =>
              (e as HTMLElement).offsetParent !== null &&
              ((e.children.length === 0 && /^\s*loading/i.test(e.textContent || '')) || /animate-pulse/.test(String((e as HTMLElement).className))),
          ),
        ),
      { timeout, intervals: [500, 1000, 2000] },
    )
    .toBe(false);
}

export const money = (s: string | null | undefined) => Number(String(s ?? '').replace(/[^0-9.-]/g, ''));
