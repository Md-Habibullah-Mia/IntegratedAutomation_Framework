import { Page } from '@playwright/test';
import { BaseWebPage } from '@core/base.page';

// Selectors kept private to the page object — tests never reference
// raw selectors, only behavior. Swap the UI, only this file changes.
const SELECTORS = {
  emailInput: '[data-testid="login-email"]',
  passwordInput: '[data-testid="login-password"]',
  submitButton: '[data-testid="login-submit"]',
  errorBanner: '[data-testid="login-error"]',
};

export class LoginPage extends BaseWebPage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto('/login');
  }

  async login(email: string, password: string) {
    await this.type(SELECTORS.emailInput, email);
    await this.type(SELECTORS.passwordInput, password);
    await this.click(SELECTORS.submitButton);
  }

  async getErrorMessage(): Promise<string> {
    return this.textOf(SELECTORS.errorBanner);
  }
}
