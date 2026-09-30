import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of LibraryScreen. The header
// count line has four forms (Audiobook-mobile library_screen.dart):
// Public — "N titles · yours to narrate", or "N titles · a preview of the
// store" while nothing is published and the app shows its own sample
// shelf; Your Library — "N items · yours to narrate", or "Nothing of yours
// here yet".
const SELECTORS = {
  header: '~Library',
  countLine:
    '//*[contains(@content-desc,"· yours to narrate") or contains(@content-desc,"· a preview of the store") or ' +
    '@content-desc="Nothing of yours here yet"]',
  publicTab: '~Public',
  yourLibraryTab: '~Your Library',
  categoryAudiobook: '~Audiobook',
  categoryVoice: '~Voice',
  categoryPdf: '~PDF',
  priceAll: '~All',
  priceFree: '~Free',
  pricePaid: '~Paid',
  addPdfAction: '//*[starts-with(@content-desc,"Add a PDF")]',
  narrateTextAction: '//*[starts-with(@content-desc,"Narrate your own text")]',
};

export class LibraryScreen extends BaseMobileScreen {
  isDisplayed() {
    return this.waitVisible(SELECTORS.header);
  }

  async getCountLineText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.countLine);
    return el.getAttribute('content-desc');
  }

  async openPublicShelf() {
    await this.click(SELECTORS.publicTab);
  }

  async openYourLibraryShelf() {
    await this.click(SELECTORS.yourLibraryTab);
  }

  async selectCategory(category: 'Audiobook' | 'Voice' | 'PDF') {
    const selector = { Audiobook: SELECTORS.categoryAudiobook, Voice: SELECTORS.categoryVoice, PDF: SELECTORS.categoryPdf }[
      category
    ];
    await this.click(selector);
  }

  isAddPdfActionVisible() {
    return this.isVisible(SELECTORS.addPdfAction);
  }

  isNarrateTextActionVisible() {
    return this.isVisible(SELECTORS.narrateTextAction);
  }

  // Public/Voice row content-desc is "{initials}\n{name}\n{traits}\nYours"
  // (owned) or "...\nFree"/"...\n{price}" (unowned) — matched by name +
  // ownership fragment since traits can vary.
  voiceRow(name: string, ownershipFragment: string) {
    return `//*[contains(@content-desc,"${name}") and contains(@content-desc,"${ownershipFragment}")]`;
  }

  async tapVoiceRow(name: string, ownershipFragment: string) {
    await this.click(this.voiceRow(name, ownershipFragment));
  }

  // Public/Audiobook catalogue row content-desc is "{title}\n{genre} ·
  // {duration}\n{'Yours' | price}" — full-width row, same dead-zone
  // family as Home's PDF card (confirmed live), so tap near the leading
  // edge rather than the reported bounds' center.
  catalogueAudiobookRow(title: string) {
    return `//*[starts-with(@content-desc,"${title}")]`;
  }

  async openCatalogueAudiobook(title: string) {
    await this.clickNearStart(this.catalogueAudiobookRow(title));
  }

  // Book detail sheet (opened by tapping a catalogue row). Primary
  // action button reads "Narrate in your voice" once owned, "Buy for
  // {price}" / "Add it" otherwise.
  isNarrateInYourVoiceVisible() {
    return this.waitVisible('~Narrate in your voice');
  }

  async tapNarrateInYourVoice() {
    await this.click('~Narrate in your voice');
  }
}
