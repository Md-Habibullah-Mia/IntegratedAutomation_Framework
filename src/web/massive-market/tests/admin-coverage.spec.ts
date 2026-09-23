// Admin Panel coverage from the Smoke and Sanity sheets of
// "Massive Market Test Cases.xlsx" (TC IDs ADM-*/ORD-* per the
// AdminPortal_TCs master sheet). Single shared admin login for the whole
// file (test.describe.serial + beforeAll), per the same convention as the
// other MassiveMarket spec files.
//
// ADM-007 approved the real pending referral-partner request that
// marketer-coverage.spec.ts's TC-039 submitted for FifthUserByReferral@test.com,
// and ADM-016 approved a real pre-existing pending merchant request
// (test_m@test.com). Both were real, deliberate, irreversible actions on
// shared dev data, run once — confirmed with the user before that first run.
//
// ADM-003/ADM-007 and ADM-012/ADM-016 are now test.skip: they assert a
// "pending" request exists to view/approve, but that request was a one-shot
// resource — the first CI run against this shared account already consumed
// it (approved it), so on every run since, there is nothing left in Pending
// and these fail. Confirmed live via CI run 35741417972's logs. ADM-009 and
// ADM-018 stay real: once approved, a request stays in the Approved list
// permanently, so those checks are safe to run on every CI pass.
//
// ORD-* (14 TCs) and ADM-032/ADM-036 are skipped: Orders and Transactions
// both have zero real records in this environment (confirmed live), and
// Marketplace has zero active merchant shops, so there is currently no way
// to generate a qualifying order to test against. Un-skip once real order
// data exists.
import { test, expect } from '@playwright/test';
import { loginToMassiveMarket } from '@utils/massive-market-session';
import { config } from '@config/env.config';
import { AdminPanelPage } from '@web/massive-market/pages/admin-panel.page';
import { AdminOrdersPage } from '@web/massive-market/pages/admin-orders.page';
import { AdminTransactionsPage } from '@web/massive-market/pages/admin-transactions.page';

const REFERRAL_PARTNER_EMAIL = process.env.LOGIN_TEST_EMAIL || 'FifthUserByReferral@test.com';
const PENDING_MERCHANT_EMAIL = 'test_m@test.com';

test.describe.serial('MassiveMarket Admin Panel coverage', () => {
  let context: import('@playwright/test').BrowserContext;
  let adminPanel: AdminPanelPage;
  let adminOrders: AdminOrdersPage;
  let adminTransactions: AdminTransactionsPage;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    const page = await context.newPage();
    await loginToMassiveMarket(page, config.massiveMarket.adminEmail!, config.massiveMarket.adminPassword!);

    adminPanel = new AdminPanelPage(page);
    adminOrders = new AdminOrdersPage(page);
    adminTransactions = new AdminTransactionsPage(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('ADM-001 - Verify Admin Panel loads successfully', async () => {
    await adminPanel.goto();
    await adminPanel.verifyLoaded();
    await expect(adminPanel.page.getByRole('link', { name: 'Admin Panel' })).toBeVisible();
    await expect(adminPanel.page.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(adminPanel.page.getByRole('link', { name: 'Transactions' })).toBeVisible();
  });

  test('ADM-002 - Verify Referral Partner Requests section is displayed', async () => {
    await adminPanel.goto();
    await expect(adminPanel.referralPartnerTab('Pending')).toBeVisible();
    await expect(adminPanel.referralPartnerTab('Approved')).toBeVisible();
    await expect(adminPanel.referralPartnerTab('Rejected')).toBeVisible();
    await expect(adminPanel.referralPartnerTab('All')).toBeVisible();
    await expect(adminPanel.referralPartnerTable()).toBeVisible();
  });

  // One-shot: the pending request this asserted was already approved by
  // ADM-007's first (and only) real run. See the file-header note.
  test.skip('ADM-003 - Verify Pending tab shows the real pending referral-partner request', () => {});

  test('ADM-004 - Verify Approved tab is selectable', async () => {
    await adminPanel.referralPartnerTab('Approved').click();
    await expect(adminPanel.referralPartnerTable()).toBeVisible();
  });

  test('ADM-005 - Verify Rejected tab is selectable', async () => {
    await adminPanel.referralPartnerTab('Rejected').click();
    await expect(adminPanel.referralPartnerTable()).toBeVisible();
  });

  // One-shot: already run for real once (see file header). Re-running would
  // need a fresh pending request first, which nothing here currently creates.
  test.skip('ADM-007 - Approve the pending Referral Partner request', () => {});

  test('ADM-009 - Verify the approved Referral Partner appears in the Approved list', async () => {
    await adminPanel.referralPartnerTab('Approved').click();
    await expect(adminPanel.referralPartnerRow(REFERRAL_PARTNER_EMAIL)).toBeVisible({ timeout: 15000 });
    await expect(adminPanel.referralPartnerRow(REFERRAL_PARTNER_EMAIL)).toContainText(/approved/i);
  });

  test('ADM-011 - Verify Merchant Requests section is displayed', async () => {
    await adminPanel.goto();
    await expect(adminPanel.merchantRequestsTab('Pending')).toBeVisible();
    await expect(adminPanel.merchantRequestsTab('Approved')).toBeVisible();
    await expect(adminPanel.merchantRequestsTab('Rejected')).toBeVisible();
    await expect(adminPanel.merchantRequestsTab('All')).toBeVisible();
    await expect(adminPanel.merchantRequestsTable()).toBeVisible();
  });

  // One-shot: the pending request this asserted was already approved by
  // ADM-016's first (and only) real run. See the file-header note.
  test.skip('ADM-012 - Verify Pending tab shows the real pending merchant request', () => {});

  test('ADM-013 - Verify Approved tab is selectable', async () => {
    await adminPanel.merchantRequestsTab('Approved').click();
    await expect(adminPanel.merchantRequestsTable()).toBeVisible();
  });

  // One-shot: already run for real once (see file header). Re-running would
  // need a fresh pending merchant request first, which nothing here creates.
  test.skip('ADM-016 - Approve the pending Merchant request', () => {});

  test('ADM-018 - Verify the approved Merchant appears in the Approved list', async () => {
    await adminPanel.merchantRequestsTab('Approved').click();
    await expect(adminPanel.merchantRequestRow(PENDING_MERCHANT_EMAIL)).toBeVisible({ timeout: 15000 });
  });

  test('ADM-023 - Verify Merchant Fee Agreements section loads', async () => {
    await adminPanel.goto();
    const tabs = adminPanel.merchantFeeAgreementsTabs();
    await expect(tabs.all).toBeVisible();
    await expect(tabs.active).toBeVisible();
    await expect(tabs.inactive).toBeVisible();
    await expect(tabs.search).toBeVisible();
    const firstRow = adminPanel.merchantFeeAgreementsTable().getByRole('row').nth(1);
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await expect(firstRow.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('ADM-029 - Verify Orders page loads', async () => {
    await adminOrders.goto();
    await adminOrders.verifyLoaded();
  });

  test('ADM-030 - Verify Orders status filters are selectable', async () => {
    await adminOrders.allFilter.click();
    await expect(adminOrders.table).toBeVisible();
    await adminOrders.awaitingReleaseFilter.click();
    await expect(adminOrders.table).toBeVisible();
    await adminOrders.releasedFilter.click();
    await expect(adminOrders.table).toBeVisible();
    await adminOrders.cancelledFilter.click();
    await expect(adminOrders.table).toBeVisible();
  });

  test('ADM-033 - Verify Transaction Ledger loads', async () => {
    await adminTransactions.goto();
    await adminTransactions.verifyLoaded();
  });

  // As of 2026-09-18 this fails: Global Commission Settings renders only its
  // heading and description — no marketer-pool-percentage field and no Save
  // control exist in the DOM at all. Confirmed live (full ARIA snapshot of
  // the section contains nothing beyond the heading/paragraph). A real
  // product gap, not a locator problem — left in place so this proves
  // itself green the moment the settings UI is implemented. Deliberately
  // last among the real (non-skipped) tests: describe.serial halts on the
  // first failure, and this one is expected to fail until the gap is fixed.
  test('ADM-020 - Verify current marketer pool percentage is displayed', async () => {
    await adminPanel.goto();
    await expect(adminPanel.globalCommissionSettingsHeading).toBeVisible();
    const section = adminPanel.globalCommissionSettingsHeading.locator('xpath=following-sibling::*[1]');
    await expect(section.getByText(/marketer pool/i)).toBeVisible({ timeout: 10000 });
    await expect(section.getByRole('button', { name: /save/i })).toBeVisible();
  });

  // --- Blocked: no real order/transaction data exists in this environment ---
  // Orders and Transactions both show 0 records (confirmed live), and
  // Marketplace has zero active merchant shops, so no order can currently be
  // generated to test against either. Un-skip once real order data exists.
  test.skip('ADM-032 - Open an order from Orders list', () => {});
  test.skip('ADM-036 - Verify transaction financial columns and Completed status', () => {});
  test.skip('ORD-037 - Verify released order detail page loads', () => {});
  test.skip('ORD-038 - Verify Gross Sale amount', () => {});
  test.skip('ORD-039 - Verify Merchant Fee amount', () => {});
  test.skip('ORD-040 - Verify Marketer Pool amount', () => {});
  test.skip('ORD-041 - Verify Platform Gross amount', () => {});
  test.skip('ORD-042 - Verify Referral Partner amount', () => {});
  test.skip('ORD-043 - Verify Platform Net amount', () => {});
  test.skip('ORD-044 - Verify Merchant Net amount', () => {});
  test.skip('ORD-048 - Verify Awaiting Release status', () => {});
  test.skip('ORD-049 - Verify Awaiting Release distribution message', () => {});
  test.skip('ORD-050 - Verify Released order status', () => {});
  test.skip('ORD-051 - Verify Released order shows Distribution Reconciled state', () => {});
  test.skip('ORD-052 - Verify Referral Partner Posting section', () => {});
  test.skip('ORD-055 - Verify Marketer Distribution section', () => {});
});
