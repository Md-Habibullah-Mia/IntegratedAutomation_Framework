import { expect, Page, Locator } from '@playwright/test';

/** Admin Transaction Ledger (/me/admin/transactions). */
export class AdminTransactionsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchBox: Locator;
  readonly ownerFilter: Locator;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly fromDateFilter: Locator;
  readonly toDateFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Transaction Ledger', level: 1 });
    this.searchBox = page.getByRole('textbox', { name: 'Search transactions' });
    this.ownerFilter = page.getByRole('textbox', { name: 'Filter transaction owner' });
    this.typeFilter = page.getByRole('combobox', { name: 'Filter transaction type' });
    this.statusFilter = page.getByRole('combobox', { name: 'Filter transaction status' });
    this.fromDateFilter = page.getByRole('textbox', { name: 'Transactions from date' });
    this.toDateFilter = page.getByRole('textbox', { name: 'Transactions to date' });
  }

  async goto() {
    await this.page.goto('/me/admin/transactions', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.searchBox).toBeVisible();
    await expect(this.ownerFilter).toBeVisible();
    await expect(this.typeFilter).toBeVisible();
    await expect(this.statusFilter).toBeVisible();
    await expect(this.fromDateFilter).toBeVisible();
    await expect(this.toDateFilter).toBeVisible();
  }
}
