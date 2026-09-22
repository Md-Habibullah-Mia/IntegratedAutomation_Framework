import { expect, Page, Locator } from '@playwright/test';

/** Admin Orders (/me/admin/orders) — escrow state, fee allocation, released distributions. */
export class AdminOrdersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchBox: Locator;
  readonly allFilter: Locator;
  readonly awaitingReleaseFilter: Locator;
  readonly releasedFilter: Locator;
  readonly cancelledFilter: Locator;
  readonly table: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Orders', level: 1 });
    this.searchBox = page.getByRole('searchbox', { name: 'Search admin orders' });
    this.allFilter = page.getByRole('button', { name: 'All', exact: true });
    this.awaitingReleaseFilter = page.getByRole('button', { name: 'Awaiting Release' });
    this.releasedFilter = page.getByRole('button', { name: 'Released', exact: true });
    this.cancelledFilter = page.getByRole('button', { name: 'Cancelled' });
    this.table = page.getByRole('table');
  }

  async goto() {
    await this.page.goto('/me/admin/orders', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.searchBox).toBeVisible();
    await expect(this.allFilter).toBeVisible();
    await expect(this.awaitingReleaseFilter).toBeVisible();
    await expect(this.releasedFilter).toBeVisible();
    await expect(this.cancelledFilter).toBeVisible();
    await expect(this.table).toBeVisible();
  }
}
