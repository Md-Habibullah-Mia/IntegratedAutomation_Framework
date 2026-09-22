import { expect, Page, Locator } from '@playwright/test';

export class AudiobookDetailPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly doneBadge: Locator;
  readonly errorBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1').first();
    this.doneBadge = page.locator('.badge-done');
    this.errorBadge = page.locator('.badge-error, .badge-fail');
  }

  /** The detail page polls every 4s until the book leaves queued/running. */
  async waitForCompletion(timeout: number) {
    await expect(this.doneBadge.or(this.errorBadge)).toBeVisible({ timeout });
  }
}
