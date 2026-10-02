import * as fs from 'fs';
import * as path from 'path';
import { Browser, BrowserContext, Page, test } from '@playwright/test';
import { config } from '@config/env.config';
import { LoginPage } from '@web/odiobuk/pages/login.page';
import { HomePage } from '@web/odiobuk/pages/home.page';

// ONE sign-in for the whole Odiobuk web run (the framework rule): the first
// spec that needs a signed-in user logs in as the admin account once and
// saves the session; every other spec opens a context from that saved
// state instead of signing in again. A saved state younger than MAX_AGE is
// reused across runs too, after a quick check that it still lands on Home.
//
// The admin account (MOBILE_TEST_ADMIN_* in .env.dev.local) is used because
// the admin-only features (/admin/pdfs) need it and it serves as an ordinary
// signed-in user everywhere else. Tests that change its data put it back.
//
// Only tests whose subject IS signing up / signing in, or that need a second
// or brand-new account, create their own — see registration, login and
// voice-privacy-security specs.

const STATE = path.resolve(__dirname, '../../.auth/odiobuk-admin.json');
const MAX_AGE_MS = 30 * 60_000;

export interface Session {
  context: BrowserContext;
  page: Page;
  home: HomePage;
}

export const sharedAccount = () => config.mobile.adminAccount;

export async function openSharedSession(browser: Browser): Promise<Session> {
  const { email, password } = sharedAccount();
  test.skip(!email || !password, 'MOBILE_TEST_ADMIN_EMAIL/PASSWORD not configured');

  if (fs.existsSync(STATE) && Date.now() - fs.statSync(STATE).mtimeMs < MAX_AGE_MS) {
    const reused = await fromSavedState(browser);
    if (reused) return reused;
  }

  const context = await browser.newContext({ baseURL: config.odiobukWebBaseUrl });
  const page = await context.newPage();
  const login = new LoginPage(page);
  const home = new HomePage(page);
  await login.goto();
  await login.login(email!, password!);
  await home.verifyLoaded();
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  await context.storageState({ path: STATE });
  return { context, page, home };
}

/**
 * Close a shared-session context — ALWAYS via this, never context.close().
 * The app keeps its access token in memory and an httpOnly refresh cookie
 * (odiobuk_refresh) that is rotated on use, so the cookie saved at sign-in
 * goes stale as soon as a page reloads; replaying it logged the next spec
 * out (verified live 2026-10-02). Writing the context's current cookie back
 * hands the next spec a live one.
 */
export async function closeSharedSession(context: BrowserContext | undefined) {
  if (!context) return;
  await context.storageState({ path: STATE }).catch(() => {});
  await context.close();
}

async function fromSavedState(browser: Browser): Promise<Session | null> {
  const context = await browser.newContext({ baseURL: config.odiobukWebBaseUrl, storageState: STATE });
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const home = new HomePage(page);
  // Home's greeting or the login form — whichever the app settles on.
  await home.welcomeHeading.or(page.getByRole('button', { name: 'Sign in' })).first().waitFor({ timeout: 30000 });
  if (!(await home.welcomeHeading.isVisible())) {
    await context.close();
    return null; // refresh cookie no longer valid — sign in once more
  }
  return { context, page, home };
}
