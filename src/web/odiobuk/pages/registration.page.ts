import { Page, Locator } from '@playwright/test';

export class RegistrationPage {
  private readonly fullName: Locator;
  private readonly email: Locator;
  private readonly password: Locator;
  private readonly createAccountButton: Locator;
  private readonly signInLink: Locator;

  constructor(private readonly page: Page) {
    this.fullName = this.page.getByRole('textbox', { name: 'Full name' });
    this.email = this.page.getByRole('textbox', { name: 'Email' });
    // The field's accessible name includes the hint ("Password (min 8
    // characters)"), so match loosely rather than the exact string.
    this.password = this.page.getByRole('textbox', { name: /Password/ });
    this.createAccountButton = this.page.getByRole('button', { name: 'Create account' });
    this.signInLink = this.page.getByRole('link', { name: 'Sign in' });
  }

  async goto() {
    await this.page.goto('/register', { waitUntil: 'domcontentloaded' });
  }

  async register(fullName: string, email: string, password: string) {
    await this.fullName.fill(fullName);
    await this.email.fill(email);
    await this.password.fill(password);
    await this.createAccountButton.click();
  }
}
