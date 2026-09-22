import { expect, Page, Locator } from '@playwright/test';

/**
 * Admin Panel (/me/admin) — Referral Partner Requests, Global Commission
 * Settings, Merchant Requests, and Merchant Fee Agreements all live on this
 * one page. They are NOT wrapped in per-section container elements (the
 * page is a flat list of headings/buttons/tables directly under <main>), so
 * sections are disambiguated positionally: Referral Partner Requests is the
 * 1st Pending/Approved/Rejected/All tab-set and the 1st table, Merchant
 * Requests is the 2nd of each, and Merchant Fee Agreements has its own
 * distinctly-labelled All/Active/Inactive tabs and 3rd table.
 */
export class AdminPanelPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly adminUserInfo: Locator;
  readonly globalCommissionSettingsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Admin Panel', level: 1 });
    this.adminUserInfo = page.getByText('ID:');
    this.globalCommissionSettingsHeading = page.getByRole('heading', { name: 'Global Commission Settings', level: 2 });
  }

  async goto() {
    await this.page.goto('/me/admin', { waitUntil: 'domcontentloaded' });
  }

  async verifyLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30000 });
    await expect(this.adminUserInfo).toBeVisible();
  }

  private tabButton(name: 'Pending' | 'Approved' | 'Rejected' | 'All', occurrence: 0 | 1): Locator {
    return this.page.getByRole('button', { name, exact: true }).nth(occurrence);
  }

  referralPartnerTab(name: 'Pending' | 'Approved' | 'Rejected' | 'All'): Locator {
    return this.tabButton(name, 0);
  }

  merchantRequestsTab(name: 'Pending' | 'Approved' | 'Rejected' | 'All'): Locator {
    return this.tabButton(name, 1);
  }

  referralPartnerTable(): Locator {
    return this.page.getByRole('table').nth(0);
  }

  merchantRequestsTable(): Locator {
    return this.page.getByRole('table').nth(1);
  }

  merchantFeeAgreementsTable(): Locator {
    return this.page.getByRole('table').nth(2);
  }

  merchantFeeAgreementsTabs() {
    return {
      all: this.page.getByRole('button', { name: 'All', exact: true }).nth(2),
      active: this.page.getByRole('button', { name: 'Active', exact: true }),
      inactive: this.page.getByRole('button', { name: 'Inactive', exact: true }),
      search: this.page.getByRole('searchbox'),
    };
  }

  /** Row in the Referral Partner Requests table matching the marketer's email. */
  referralPartnerRow(email: string): Locator {
    return this.referralPartnerTable().getByRole('row').filter({ hasText: email });
  }

  /** Row in the Merchant Requests table matching the merchant's email. */
  merchantRequestRow(email: string): Locator {
    return this.merchantRequestsTable().getByRole('row').filter({ hasText: email });
  }

  async approveReferralPartner(email: string) {
    this.page.once('dialog', (d) => d.accept());
    await this.referralPartnerRow(email).getByRole('button', { name: 'Approve' }).click();
  }

  async approveMerchantRequest(email: string) {
    this.page.once('dialog', (d) => d.accept());
    await this.merchantRequestRow(email).getByRole('button', { name: 'Approve' }).click();
  }
}
