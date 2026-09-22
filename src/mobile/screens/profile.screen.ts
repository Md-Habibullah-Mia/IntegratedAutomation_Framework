import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of ProfileScreen, reached by
// tapping the avatar circle in the Home masthead. The "ACCOUNT" info
// card's rows (Signs in with / Member since / Privacy charter / …
// Private vault) are Flutter-merged into ONE semantics node, so its
// reported bounds don't reliably indicate where each sub-row's real
// gesture detector is — same dead-zone family as the Home PDF card, but
// here the fix is knowing "Private vault" sits at the *bottom* of that
// merged block, not guessing its on-screen position from a screenshot
// without correcting for device-pixel scale (a mistake made once while
// mapping this screen — left as a reminder for the next screen like it).
const SELECTORS = {
  header: '~Profile',
  identity: '//*[contains(@content-desc,"Member —")]',
  statsLine: '//*[contains(@content-desc,"HOURS") and contains(@content-desc,"FINISHED")]',
  usageCard: '//*[contains(@content-desc,"· USAGE")]',
  premiumCard: '//*[starts-with(@content-desc,"PREMIUM EDITION")]',
  upgradeButton: '~Upgrade',
  restorePurchasesButton: '~Restore purchases',
  accountCard: '//*[contains(@content-desc,"Signs in with") and contains(@content-desc,"Private vault")]',
  upgradeDialogTitle: '~Switch to Premium Edition?',
  upgradeNotNowButton: '~Not now',
};

export class ProfileScreen extends BaseMobileScreen {
  isDisplayed() {
    return this.waitVisible(SELECTORS.header);
  }

  isIdentityVisible() {
    return this.waitVisible(SELECTORS.identity);
  }

  async getIdentityText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.identity);
    return el.getAttribute('content-desc');
  }

  isStatsLineVisible() {
    return this.waitVisible(SELECTORS.statsLine);
  }

  async getUsageCardText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.usageCard);
    return el.getAttribute('content-desc');
  }

  async getPremiumCardText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.premiumCard);
    return el.getAttribute('content-desc');
  }

  async getAccountCardText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.accountCard);
    return el.getAttribute('content-desc');
  }

  async tapUpgrade() {
    await this.click(SELECTORS.upgradeButton);
  }

  isUpgradeDialogVisible() {
    return this.waitVisible(SELECTORS.upgradeDialogTitle);
  }

  async declineUpgradeDialog() {
    await this.click(SELECTORS.upgradeNotNowButton);
  }

  // "Private vault" is the last row in the merged ACCOUNT card, which
  // sits below the fold on first load — scroll it into view first, or
  // getLocation()/getSize() reflect a partially-clipped element and the
  // computed tap point misses (found live: worked only after scrolling).
  // Then tap near its known position rather than the card's own (much
  // larger, multi-row) reported bounds.
  async openPrivateVault() {
    // Starting scroll position varies by how the screen was reached, and
    // a swipe's very first call in a freshly-started Appium session has
    // been observed to silently no-op once (confirmed live: identical
    // code scrolled reliably mid-session but did nothing as the first
    // gesture of a new session) — so swipe repeatedly and confirm actual
    // progress (via "Log out", which only exists below the account
    // card) rather than assuming any fixed swipe count worked.
    for (let i = 0; i < 5; i += 1) {
      if (await this.isVisible('~Log out')) break;
      await this.swipe('up');
      await this.driver.pause(400);
    }
    const el = await this.driver.$(SELECTORS.accountCard);
    await el.waitForDisplayed({ timeout: 15000 });
    const location = await el.getLocation();
    const size = await el.getSize();
    // The card merges 7 rows; "Private vault" is the last, so target
    // near the bottom rather than the vertical center.
    const x = location.x + 40;
    const y = location.y + size.height - 60;
    await this.driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 80 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
  }
}
