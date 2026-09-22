import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of VaultScreen, reached via
// Profile > Private vault.
const SELECTORS = {
  header: '~Private vault',
  statusLine: '//*[starts-with(@content-desc,"Always encrypted")]',
  importButton: '~Import & encrypt an audio file',
  inTheVaultSection: '~IN THE VAULT',
  emptyState: '//*[starts-with(@content-desc,"Your vault is empty")]',
  backButton: '~Back',
};

export class VaultScreen extends BaseMobileScreen {
  isDisplayed() {
    return this.waitVisible(SELECTORS.header);
  }

  async getStatusLineText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.statusLine);
    return el.getAttribute('content-desc');
  }

  isImportButtonVisible() {
    return this.isVisible(SELECTORS.importButton);
  }

  isEmptyStateVisible() {
    return this.isVisible(SELECTORS.emptyState);
  }

  async goBack() {
    await this.click(SELECTORS.backButton);
  }
}
