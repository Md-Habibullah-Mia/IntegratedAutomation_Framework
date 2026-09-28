import { expect, Locator, Page } from '@playwright/test';

// Page objects for LexVerify's public (signed-out) screens. Selectors come
// from the app's own source (AttorneyProject/frontend/app/**/page.tsx):
// placeholders, button names, aria-labels and data-testids — not guessed.
//
// goto() waits for 'networkidle': these are client-rendered Next.js pages,
// and typing before React hydrates is silently lost (FPW-003 read an empty
// email after fill('abc@') when the page was only at domcontentloaded).

/** Shared field-level error, rendered as <p class="error-msg"> in every auth form. */
function errors(page: Page): Locator {
  return page.locator('.error-msg');
}

export class LandingPage {
  constructor(private readonly page: Page) {}

  readonly individualCard = () => this.page.locator('a[href="/login?role=individual"]');
  readonly firmCard = () => this.page.locator('a[href="/register"]').filter({ hasText: 'Law Firm / Corporate' });

  async goto() {
    await this.page.goto('/', { waitUntil: 'networkidle' });
  }

  async expectLoaded() {
    await expect(this.page.getByText('Welcome to LexVerify')).toBeVisible();
    await expect(this.individualCard()).toContainText('Individual / Petitioner');
    await expect(this.firmCard()).toBeVisible();
  }
}

export class RegisterPage {
  constructor(private readonly page: Page) {}

  readonly email = () => this.page.getByPlaceholder('Work Email');
  readonly password = () => this.page.getByPlaceholder('Password', { exact: true });
  readonly submit = () => this.page.getByRole('button', { name: 'Create Secure Account' });
  readonly errors = () => errors(this.page);

  async goto() {
    await this.page.goto('/register', { waitUntil: 'networkidle' });
    await expect(this.submit()).toBeVisible();
  }

  async fillAndSubmit(email: string, password: string) {
    await this.email().fill(email);
    await this.password().fill(password);
    await this.submit().click();
  }
}

export class LoginPage {
  constructor(private readonly page: Page) {}

  readonly email = () => this.page.locator('input[type="email"]');
  readonly password = () => this.page.locator('input[autocomplete="current-password"]');
  readonly submit = () => this.page.getByRole('button', { name: 'Secure Login' });
  readonly errors = () => errors(this.page);
  readonly subtitle = (text: string) => this.page.getByText(text, { exact: true });
  readonly registerFirmLink = () => this.page.getByRole('link', { name: 'Register your firm' });
  readonly expiredBanner = () => this.page.getByTestId('session-expired-banner');

  async goto(role: 'firm' | 'client' | 'individual' = 'firm', extra = '') {
    await this.page.goto(`/login?role=${role}${extra}`, { waitUntil: 'networkidle' });
    await expect(this.submit()).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.email().fill(email);
    await this.password().fill(password);
    await this.submit().click();
  }
}

export class VerifyPage {
  constructor(private readonly page: Page) {}

  readonly digit = (n: number) => this.page.getByLabel(`Verification digit ${n}`);
  readonly verifyButton = () => this.page.getByRole('button', { name: 'Verify Code' });
  readonly errors = () => errors(this.page);

  async goto() {
    await this.page.goto('/verify', { waitUntil: 'networkidle' });
    await expect(this.page.getByRole('heading', { name: 'Verify Your Identity' })).toBeVisible();
  }

  async typeCode(code: string) {
    for (let i = 0; i < code.length; i += 1) await this.digit(i + 1).fill(code[i]);
  }
}

export class ForgotPasswordPage {
  constructor(private readonly page: Page) {}

  readonly email = () => this.page.getByPlaceholder('attorney@firm.com');
  readonly sendCode = () => this.page.getByRole('button', { name: 'Send Reset Code' });
  readonly errors = () => errors(this.page);

  async goto() {
    await this.page.goto('/forgot-password', { waitUntil: 'networkidle' });
    await expect(this.page.getByText('Reset Password', { exact: true })).toBeVisible();
  }
}

export class InviteAcceptPage {
  constructor(private readonly page: Page) {}

  async goto(token?: string) {
    await this.page.goto(token === undefined ? '/invite/accept' : `/invite/accept?token=${encodeURIComponent(token)}`, {
      waitUntil: 'networkidle',
    });
  }
}
