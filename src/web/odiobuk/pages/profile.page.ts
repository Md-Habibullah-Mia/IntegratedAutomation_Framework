import { expect, Page, Locator } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly displayNameInput: Locator;
  readonly speedSelect: Locator;
  readonly acknowledgeButton: Locator;
  readonly exportButton: Locator;
  readonly deleteConfirmInput: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1, name: /^You/ });
    this.displayNameInput = page.getByRole('textbox', { name: 'Display name' });
    this.speedSelect = page.getByRole('combobox', { name: /Default speed/ });
    this.acknowledgeButton = page.getByRole('button', { name: /Acknowledge|Reset acknowledgement/ });
    this.exportButton = page.getByRole('button', { name: /Export my data/ });
    this.deleteConfirmInput = page.getByPlaceholder('Type DELETE to confirm');
    this.deleteButton = page.getByRole('button', { name: 'Delete my account' });
  }

  async goto() {
    await this.page.goto('/profile', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.displayNameInput).toBeVisible();
  }

  async setDisplayName(name: string) {
    await this.displayNameInput.fill(name);
    await this.displayNameInput.blur();
  }
}
