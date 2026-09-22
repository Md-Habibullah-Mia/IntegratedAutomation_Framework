import { expect, Page, Locator } from '@playwright/test';

/** "Marketplace" (/me/marketplace) — browse merchant shops. */
export class MarketplacePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly becomeMerchantLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Marketplace', level: 1 });
    this.searchInput = page.getByPlaceholder('Search shops...');
    this.becomeMerchantLink = page.getByRole('link', { name: 'Become a Merchant' });
  }

  async goto() {
    await this.page.goto('/me/marketplace', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.searchInput).toBeVisible();
    await expect(this.becomeMerchantLink).toBeVisible();
  }
}
