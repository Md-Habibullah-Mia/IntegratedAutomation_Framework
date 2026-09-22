import { expect, Page, Locator } from '@playwright/test';

/**
 * "Wallet" (/me/wallet) — balance, escrow, lifetime earnings, recent
 * transactions. Loads noticeably slower than other pages (observed 15-20s
 * for the real content to replace "Loading wallet…"), so verifyLoaded uses
 * a longer timeout.
 */
export class WalletPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly availableBalanceLabel: Locator;
  readonly pendingEscrowLabel: Locator;
  readonly lifetimeEarningsLabel: Locator;
  readonly recentTransactionsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'My Wallet', level: 1 });
    this.availableBalanceLabel = page.getByText('Available balance', { exact: true });
    this.pendingEscrowLabel = page.getByText('Pending Escrow', { exact: true });
    this.lifetimeEarningsLabel = page.getByText('Lifetime Earnings', { exact: true });
    this.recentTransactionsHeading = page.getByRole('heading', { name: 'Recent Transactions', level: 2 });
  }

  async goto() {
    await this.page.goto('/me/wallet', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.availableBalanceLabel).toBeVisible({ timeout: 30000 });
    await expect(this.pendingEscrowLabel).toBeVisible();
    await expect(this.lifetimeEarningsLabel).toBeVisible();
    await expect(this.recentTransactionsHeading).toBeVisible();
  }
}
