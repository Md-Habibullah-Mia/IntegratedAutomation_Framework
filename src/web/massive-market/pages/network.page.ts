import { expect, Page, Locator } from '@playwright/test';

/** "My Users" (/me/users) — the MLM referral network / downline view. */
export class NetworkPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly networkSectionHeading: Locator;
  readonly levelLabels: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'My Users', level: 1 });
    this.networkSectionHeading = page.getByText('MLM Network', { exact: true });
    this.levelLabels = page.getByText(/^Level \d/);
  }

  async goto() {
    await this.page.goto('/me/users', { waitUntil: 'domcontentloaded' });
  }

  /** The referral tree fetch is slow — give it real time before asserting content. */
  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.networkSectionHeading).toBeVisible({ timeout: 30000 });
    await expect(this.levelLabels.first()).toBeVisible({ timeout: 30000 });
  }
}
