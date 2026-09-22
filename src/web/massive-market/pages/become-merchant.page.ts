import { expect, Page, Locator } from '@playwright/test';

/**
 * "Become a Merchant" (/me/become-merchant) — merchant-signup pitch page.
 * Clicking its "Become Merchant" button opens a "Merchant Registration"
 * modal dialog: this creates a SEPARATE new merchant account (its own login
 * email/password), not an upgrade of the current marketer session —
 * confirmed live (the resulting account shows up on the sign-in page as
 * "Merchant application submitted... An admin must approve the merchant
 * application before you can log in").
 *
 * The dialog's fields have no <label> association — their accessible name
 * is their placeholder text, so locators use getByPlaceholder(), scoped to
 * the dialog. Password and Confirm Password share the identical placeholder
 * ("********"), so they're disambiguated positionally (nth(0)/nth(1)).
 */
export class BecomeMerchantPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly becomeMerchantButton: Locator;
  readonly registrationDialog: Locator;
  readonly merchantEmailInput: Locator;
  readonly firstNameInput: Locator;
  readonly middleNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly businessNameInput: Locator;
  readonly websiteUrlInput: Locator;
  readonly businessCategoryInput: Locator;
  readonly supportEmailInput: Locator;
  readonly referralCodeInput: Locator;
  readonly createMerchantAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Accelerate Your Growth Journey', level: 1 });
    this.becomeMerchantButton = page.getByRole('button', { name: 'Become Merchant' });
    this.registrationDialog = page.getByRole('dialog', { name: 'Merchant Registration' });
    this.merchantEmailInput = this.registrationDialog.getByPlaceholder('merchant@example.com');
    this.firstNameInput = this.registrationDialog.getByPlaceholder('Rohan');
    this.middleNameInput = this.registrationDialog.getByPlaceholder('Optional');
    this.lastNameInput = this.registrationDialog.getByPlaceholder('Iban');
    this.passwordInput = this.registrationDialog.getByPlaceholder('********').nth(0);
    this.confirmPasswordInput = this.registrationDialog.getByPlaceholder('********').nth(1);
    this.businessNameInput = this.registrationDialog.getByPlaceholder('Jordan Crop');
    this.websiteUrlInput = this.registrationDialog.getByPlaceholder('http://-jordan.com');
    this.businessCategoryInput = this.registrationDialog.getByPlaceholder('Software, E-commerce, etc.');
    this.supportEmailInput = this.registrationDialog.getByPlaceholder('jordan@example.com');
    this.referralCodeInput = this.registrationDialog.getByPlaceholder('Shop registration code');
    this.createMerchantAccountButton = this.registrationDialog.getByRole('button', { name: 'Create Merchant Account' });
  }

  async goto() {
    await this.page.goto('/me/become-merchant', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.becomeMerchantButton).toBeVisible();
  }

  async openRegistrationForm() {
    await this.becomeMerchantButton.click();
    await expect(this.registrationDialog).toBeVisible({ timeout: 15000 });
  }

  async submitRegistration(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    businessName: string;
    businessCategory: string;
    supportEmail: string;
    referralCode: string;
  }) {
    await this.merchantEmailInput.fill(data.email);
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.password);
    await this.businessNameInput.fill(data.businessName);
    await this.businessCategoryInput.fill(data.businessCategory);
    await this.supportEmailInput.fill(data.supportEmail);
    // Required despite not being marked so visually — omitting it blocks
    // submission with "Referral code is required."
    await this.referralCodeInput.fill(data.referralCode);
    await this.createMerchantAccountButton.click();
  }
}
