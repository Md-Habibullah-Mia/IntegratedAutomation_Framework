import { config } from '@config/env.config';
import { BaseMobileScreen } from '@core/base.screen';

// Captured from a live accessibility dump of the real post-login home
// screen (only reachable by completing "First-Login Verification" — see
// CHANGELOG Phase 11/12). Greeting is time-based ("Good morning,"/
// "Good afternoon,"/"Good evening,") once the account has any content,
// or the literal "Welcome," on a true first-run account — matched by
// prefix, not exact text, since it changes through the day.
const SELECTORS = {
  greeting:
    '//*[starts-with(@content-desc,"Good morning,") or ' +
    'starts-with(@content-desc,"Good afternoon,") or ' +
    'starts-with(@content-desc,"Good evening,") or ' +
    'starts-with(@content-desc,"Welcome,")]',
  nothingPlayingYet: '~Nothing playing yet',
  audiobooksAll: '//*[starts-with(@content-desc,"YOUR AUDIOBOOKS")]',
  pdfsAll: '//*[starts-with(@content-desc,"YOUR BOOKS")]',
  navHome: '~HOME',
  navToday: '~TODAY',
  navLibrary: '~LIBRARY',
  navVoices: '~VOICES',
  // The masthead avatar shows the account's first-name initial — "K"
  // for this test account. Not a stable general-purpose selector (would
  // need to be parameterized per account), but fine for this suite.
  avatar: '~K',
};

export class HomeScreen extends BaseMobileScreen {
  async isDisplayed(): Promise<boolean> {
    return this.isVisible(SELECTORS.greeting);
  }

  async getGreetingText(): Promise<string> {
    const el = await this.driver.$(SELECTORS.greeting);
    return el.getAttribute('content-desc');
  }

  isNothingPlayingYetVisible() {
    return this.isVisible(SELECTORS.nothingPlayingYet);
  }

  isAudiobooksSectionVisible() {
    return this.isVisible(SELECTORS.audiobooksAll);
  }

  isPdfSectionVisible() {
    return this.isVisible(SELECTORS.pdfsAll);
  }

  // Audiobook cards' content-desc is "{title}\nYour voice" (or "\nRead by
  // {voice}"); PDF cards are "{filename}\n{N} pages". A PDF generated from
  // its own audiobook shares the same filename prefix as the audiobook
  // card, so prefix-matching alone is ambiguous — disambiguate by
  // requiring "pages" only on the PDF selector.
  audiobookTile(titlePrefix: string) {
    return `//*[starts-with(@content-desc,"${titlePrefix}") and not(contains(@content-desc,"pages"))]`;
  }

  pdfTile(filenamePrefix: string) {
    return `//*[starts-with(@content-desc,"${filenamePrefix}") and contains(@content-desc,"pages")]`;
  }

  async openAudiobook(titlePrefix: string) {
    await this.click(this.audiobookTile(titlePrefix));
  }

  async openPdf(filenamePrefix: string) {
    // Full-width row — center-click lands in a dead zone (see
    // BaseMobileScreen.clickNearStart); tap near the leading icon instead.
    await this.clickNearStart(this.pdfTile(filenamePrefix));
  }

  async openAllAudiobooks() {
    await this.click(SELECTORS.audiobooksAll);
  }

  async openToday() {
    await this.click(SELECTORS.navToday);
  }

  async openLibrary() {
    await this.click(SELECTORS.navLibrary);
  }

  async openVoices() {
    await this.click(SELECTORS.navVoices);
  }

  async openHome() {
    await this.click(SELECTORS.navHome);
  }

  async openProfile() {
    await this.click(SELECTORS.avatar);
  }

  // With noReset:true, a new Appium session attaches to whatever screen
  // the app was last left on rather than relaunching fresh — so specs
  // need a reliable way to get back to a known-good Home state.
  //
  // Three things learned live, the hard way, shape this method:
  // 1. Home/Today/Library/Voices are sibling tabs in an IndexedStack, not
  //    pushed routes — pressing "back" while on one doesn't switch to the
  //    Home tab, it exits the app to the launcher outright. So try
  //    tapping the HOME nav button directly first; only fall back to
  //    "back" for popping an actually-pushed screen (Profile, Player,
  //    AudiobooksScreen, …) where the bottom nav isn't even visible.
  // 2. `mobile: activateApp` only foregrounds an already-running process
  //    — if the app never actually died, it resumes exactly where it
  //    was (confirmed live: resumed straight back onto Library, not
  //    Home). It is not a substitute for a real cold start.
  // 3. A genuine cold start (force-stop, then a fresh am start) does
  //    reliably land on Home, because it correctly re-resolves session
  //    and verification state from what's persisted locally rather than
  //    resuming in-memory navigation state.
  async ensureDisplayed() {
    if (await this.isDisplayed()) return;

    if (await this.isVisible(SELECTORS.navHome)) {
      await this.openHome();
      if (await this.isDisplayed()) return;
    }

    for (let i = 0; i < 2; i += 1) {
      await this.driver.back();
      await this.driver.pause(500);
      if (await this.isDisplayed()) return;
      if (await this.isVisible(SELECTORS.navHome)) {
        await this.openHome();
        if (await this.isDisplayed()) return;
      }
    }

    await this.driver.execute('mobile: terminateApp', { appId: config.mobile.appPackage });
    await this.driver.pause(500);
    await this.driver.execute('mobile: activateApp', { appId: config.mobile.appPackage });
    await this.driver.pause(2000);
    const displayed = await this.waitVisible(SELECTORS.greeting, 20000);
    if (!displayed) {
      throw new Error('HomeScreen.ensureDisplayed: could not recover to Home after nav attempts and a full app restart');
    }
  }
}
