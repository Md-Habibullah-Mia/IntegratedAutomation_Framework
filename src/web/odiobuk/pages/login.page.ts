import { Page, Locator } from '@playwright/test';

export class LoginPage {
  private readonly email: Locator;
  private readonly password: Locator;
  private readonly signInButton: Locator;
  private readonly createOneLink: Locator;

  constructor(private readonly page: Page) {
    this.email = this.page.getByRole('textbox', { name: 'Email' });
    this.password = this.page.getByRole('textbox', { name: 'Password' });
    this.signInButton = this.page.getByRole('button', { name: 'Sign in' });
    this.createOneLink = this.page.getByRole('link', { name: 'Create one' });
  }

  async goto() {
    // Root redirects here when unauthenticated, but go direct for a
    // deterministic starting point regardless of session state.
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
  }

  async login(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signInButton.click();
  }

  async goToRegister() {
    await this.createOneLink.click();
  }
}
