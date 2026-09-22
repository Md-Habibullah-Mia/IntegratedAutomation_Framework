import { expect, Page, Locator } from '@playwright/test';

/** "My Links" (/me/links) — tracking-link / click-attribution stats. */
export class LinksPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly totalClicksLabel: Locator;
  readonly activeLinksLabel: Locator;
  readonly promotedShopsLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Tracking Links', level: 1 });
    this.totalClicksLabel = page.getByText('Total Clicks', { exact: true });
    this.activeLinksLabel = page.getByText('Active Links', { exact: true });
    this.promotedShopsLabel = page.getByText('Promoted Shops', { exact: true });
  }

  async goto() {
    await this.page.goto('/me/links', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.totalClicksLabel).toBeVisible({ timeout: 30000 });
    await expect(this.activeLinksLabel).toBeVisible();
    await expect(this.promotedShopsLabel).toBeVisible();
  }
}
