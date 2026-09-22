import { expect, Page, Locator } from '@playwright/test';

/** "My Order" (/me/orders) — marketer's own affiliate sales/commissions. */
export class MyOrdersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchBox: Locator;
  readonly filterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'My Orders', level: 1 });
    this.searchBox = page.getByRole('textbox', { name: /Search Orders/i });
    this.filterButton = page.getByRole('button', { name: 'Filter' });
  }

  async goto() {
    await this.page.goto('/me/orders', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.searchBox).toBeVisible();
    await expect(this.page.getByText('Total Orders')).toBeVisible();
    await expect(this.page.getByText('Total Sales')).toBeVisible();
  }
}
