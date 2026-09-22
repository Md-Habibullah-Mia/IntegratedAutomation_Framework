import { Page, test } from '@playwright/test';
import { config } from '@config/env.config';
import { LoginPage } from '@web/odiobuk/pages/login.page';
import { HomePage } from '@web/odiobuk/pages/home.page';

// Upload PDF / Documents (and therefore PDF-sourced narration) are gated to
// the pre-provisioned admin account on this deployment — a freshly
// self-registered account never gets the "Upload PDF" nav link and is
// bounced back to / if it navigates to /documents directly. Specs that
// exercise those features log in as this admin account instead of
// registering a fresh one.
export async function loginAsAdmin(page: Page): Promise<HomePage> {
  const email = config.mobile.adminAccount.email;
  const password = config.mobile.adminAccount.password;
  test.skip(!email || !password, 'MOBILE_TEST_ADMIN_EMAIL/PASSWORD not configured');

  const loginPage = new LoginPage(page);
  const homePage = new HomePage(page);
  await loginPage.goto();
  await loginPage.login(email!, password!);
  await homePage.verifyLoaded();
  return homePage;
}
