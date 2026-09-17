import { expect, Locator, Page } from '@playwright/test';

const NAV_LINK_NAMES = [
  'Overview',
  'Marketplace',
  'Wallet',
  'Transactions',
  'My Order',
  'My Users',
  'My Links',
] as const;

export class DashboardPage {
  readonly page: Page;
  readonly dashboardHeading: Locator;
  readonly logOutButton: Locator;
  // "Available Wallet" (main content) stays put across viewports, unlike the
  // header "Balance" figure, which mobile replaces with an account-details button.
  readonly availableWalletLabel: Locator;
  readonly openNavigationButton: Locator;
  readonly navLinks: Record<(typeof NAV_LINK_NAMES)[number], Locator>;

  constructor(page: Page) {
    this.page = page;

    this.dashboardHeading = page.getByRole('heading', {
      name: /dashboard/i,
      level: 1,
    });

    this.logOutButton = page.getByRole('button', { name: 'Log Out' });

    this.availableWalletLabel = page.getByText('Available Wallet', {
      exact: true,
    });

    // Mobile collapses the sidebar (nav links + Log Out) behind this button.
    this.openNavigationButton = page.getByRole('button', {
      name: 'Open navigation',
    });

    this.navLinks = Object.fromEntries(
      NAV_LINK_NAMES.map((name) => [name, page.getByRole('link', { name })])
    ) as Record<(typeof NAV_LINK_NAMES)[number], Locator>;
  }

  async goto() {
    await this.page.goto('/me/dashboard');
  }

  async verifyDashboardLoaded() {
    await expect(this.page).toHaveURL(/\/me\/dashboard/, {
      timeout: 30000,
    });

    await expect(this.dashboardHeading).toBeVisible({
      timeout: 30000,
    });
  }

  private async openSidebarIfCollapsed() {
    if (await this.openNavigationButton.isVisible().catch(() => false)) {
      await this.openNavigationButton.click();
    }
  }

  async verifyNavigationVisible() {
    await this.openSidebarIfCollapsed();

    for (const name of NAV_LINK_NAMES) {
      await expect(this.navLinks[name]).toBeVisible();
    }
  }
}
