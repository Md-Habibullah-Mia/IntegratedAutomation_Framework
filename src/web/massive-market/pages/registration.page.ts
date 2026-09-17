import { expect, Page, Locator } from '@playwright/test';

export class RegistrationPage {
  private readonly firstName: Locator;
  private readonly middleName: Locator;
  private readonly lastName: Locator;
  private readonly email: Locator;
  private readonly phone: Locator;
  private readonly referralCode: Locator;
  private readonly password: Locator;
  private readonly confirmPassword: Locator;
  private readonly termsCheckbox: Locator;
  private readonly createAccountButton: Locator;

  constructor(private readonly page: Page) {
    this.firstName = this.page.getByPlaceholder('Rohan', {
      exact: true,
    });

    this.middleName = this.page.getByPlaceholder('Optional', {
      exact: true,
    });

    this.lastName = this.page.getByPlaceholder('Iban', {
      exact: true,
    });

    this.email = this.page.locator('input[type="email"]');

    this.phone = this.page.locator('input[type="tel"]');

    this.referralCode = this.page.getByPlaceholder(
      'Code from your referrer',
      {
        exact: true,
      }
    );

    this.password = this.page
      .locator('input[type="password"]')
      .nth(0);

    this.confirmPassword = this.page
      .locator('input[type="password"]')
      .nth(1);

    this.termsCheckbox = this.page.getByRole('checkbox', {
      name: /terms of service and privacy policy/i,
    });

    this.createAccountButton = this.page.getByRole('button', {
      name: 'Create Account',
    });
  }

  async goto() {
    await this.page.goto('/auth/sign-up', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await expect(this.createAccountButton).toBeVisible({
      timeout: 10000,
    });
  }

  /**
   * Fills a controlled input and gives the form a brief settle period before
   * moving to the next field. This avoids losing values while the app recalculates
   * validation after each change.
   */
  private async typeIntoField(locator: Locator, value: string) {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    await locator.scrollIntoViewIfNeeded();
    await locator.fill(value);
    await expect(locator).toHaveValue(value, { timeout: 15000 });
    await this.page.waitForTimeout(700);
  }

  async register(data: {
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    phone: string;
    referralCode?: string;
    password: string;
    confirmPassword?: string;
  }) {
    // Fill the required fields first and let the form settle before touching the
    // first name again. In this app, updating the optional middle-name or other
    // later fields can clear the first-name input.
    await this.firstName.waitFor({ state: 'visible' });
    await expect(this.firstName).toBeEditable();

    // Last Name
    await this.typeIntoField(this.lastName, data.lastName);

    // Email
    await this.typeIntoField(this.email, data.email);

    // Phone
    await this.typeIntoField(this.phone, data.phone);

    // Referral Code
    if (data.referralCode) {
      await this.typeIntoField(this.referralCode, data.referralCode);
    }

    // Password
    await this.typeIntoField(this.password, data.password);

    // Confirm Password
    await this.typeIntoField(
      this.confirmPassword,
      data.confirmPassword ?? data.password
    );

    // Fill the first name last so it does not get cleared by the app's rerender.
    await this.typeIntoField(this.firstName, data.firstName);
    await expect(this.firstName).toHaveValue(data.firstName);

    // Middle Name - optional, fill after the required fields are stable.
    if (data.middleName) {
      await this.typeIntoField(this.middleName, data.middleName);
    }

    // Terms & Privacy Policy
    await this.termsCheckbox.check();

    // Give the form validation a brief moment to react to the final state.
    await this.page.waitForTimeout(500);

    // Create Account
    await expect(this.createAccountButton).toBeEnabled({
      timeout: 15000,
    });

    await this.createAccountButton.click();
  }
}
