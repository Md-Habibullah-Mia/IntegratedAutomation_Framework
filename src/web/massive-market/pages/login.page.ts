import { expect, Page, Locator } from '@playwright/test';

export class LoginPage {
  private readonly email: Locator;
  private readonly password: Locator;
  private readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.email = this.page.locator('input[type="email"]');
    this.password = this.page.locator('input[type="password"]');

    this.loginButton = this.page.getByRole('button', {
      name: 'Log In',
    });
  }

  async goto() {
    // domcontentloaded, not the default 'load' — some background request on
    // this page never settles, so waiting for the full 'load' event hangs
    // intermittently even though the form is already interactive.
    await this.page.goto('/auth/sign-in', { waitUntil: 'domcontentloaded' });
  }

  async login(email: string, password: string) {
    await this.email.pressSequentially(email, { delay: 40 });
    await this.password.pressSequentially(password, { delay: 40 });

    // The app validates controlled inputs asynchronously, so give the form a
    // brief moment to update before checking if the CTA is enabled.
    await this.page.waitForTimeout(600);

    await expect(this.loginButton).toBeEnabled({ timeout: 15000 });
    await this.loginButton.click();
  }
}
