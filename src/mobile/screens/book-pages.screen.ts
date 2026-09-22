import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of BookPagesScreen, reached by
// tapping a PDF card from Home/Library.
const SELECTORS = {
  backButton: '~Back',
  selectFromStart: '~SELECT FROM START (WITHIN LIMIT)',
  clear: '~CLEAR',
  useSelection: '~Use Selection in Audiobooks →',
  header: '//*[contains(@content-desc," pages · ") and contains(@content-desc," chars")]',
};

export class BookPagesScreen extends BaseMobileScreen {
  isDisplayed() {
    return this.waitVisible(SELECTORS.header);
  }

  isFilenameVisible(filename: string) {
    return this.isVisible(`~${filename}`);
  }

  pageRow(pageLabelPrefix: string) {
    return `//*[starts-with(@content-desc,"${pageLabelPrefix}")]`;
  }

  async goBack() {
    await this.click(SELECTORS.backButton);
  }

  isUseSelectionEnabled() {
    // WebdriverIO doesn't have a generic "enabled" getter for disabled
    // Flutter buttons rendered this way, so callers check clickability
    // via a tap + follow-up state check where it matters.
    return this.isVisible(SELECTORS.useSelection);
  }
}
