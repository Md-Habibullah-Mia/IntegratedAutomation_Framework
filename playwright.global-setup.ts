import { chromium, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './src/config/env.config';

const authFile = path.resolve(__dirname, '.auth/massive-market-auth.json');

async function globalSetup() {
  const email = process.env.LOGIN_TEST_EMAIL;
  const password = process.env.LOGIN_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'LOGIN_TEST_EMAIL and LOGIN_TEST_PASSWORD must be set before running MassiveMarket auth-backed tests.'
    );
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${config.massiveMarketWebBaseUrl}/auth/sign-in`, {
    waitUntil: 'domcontentloaded',
  });

  const merchantApprovalMessage = page.getByText(/merchant application submitted|admin must approve/i);
  if (await merchantApprovalMessage.isVisible().catch(() => false)) {
    await browser.close();
    throw new Error(
      'MassiveMarket merchant account is not approved yet. The auth-backed login tests cannot run until an approved account exists for LOGIN_TEST_EMAIL.'
    );
  }

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  const loginButton = page.getByRole('button', { name: 'Log In' });
  await expect(loginButton).toBeEnabled({ timeout: 15000 });
  await loginButton.click();

  await page.waitForURL(/\/me\/dashboard/, { timeout: 30000 });

  await context.storageState({ path: authFile });
  await browser.close();
}

export default globalSetup;
