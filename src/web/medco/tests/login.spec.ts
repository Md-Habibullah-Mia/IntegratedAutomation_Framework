import { test, expect } from '@playwright/test';
import { LoginPage } from '@web/medco/pages/login.page';
import { testUsers } from '@utils/data-provider';

test.describe('Medco Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.open();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await loginPage.login(testUsers.valid.email, testUsers.valid.password);
    await loginPage.waitForUrlContains('/dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('invalid credentials show an error', async () => {
    await loginPage.login(testUsers.invalid.email, testUsers.invalid.password);
    const error = await loginPage.getErrorMessage();
    expect(error).toContain('Invalid');
  });

  // Data-driven: same test body, multiple datasets — this is how the
  // framework scales coverage without scaling maintenance effort.
  for (const [name, creds] of Object.entries(testUsers.edgeCases)) {
    test(`edge case: ${name}`, async () => {
      await loginPage.login(creds.email, creds.password);
      const error = await loginPage.getErrorMessage();
      expect(error).toBeTruthy();
    });
  }
});
